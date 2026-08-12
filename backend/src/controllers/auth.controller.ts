import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { logActivity } from "../services/auditLog.service.js";
import { sanitizePhoneNumber, formatToWaJid } from "../utils/phoneSanitizer.js";
import { getSocket } from "../services/whatsapp.service.js";
import { sendHumanLikeWaMessage } from "../services/whatsappBot.service.js";

/**
 * GET /api/v1/auth/check-username?username=budi
 * Cek ketersediaan username secara real-time
 */
export async function checkUsername(req: any, res: any) {
  try {
    const { username } = req.query;
    if (!username || username.length < 3) {
      return res.json({ available: false, suggestions: [] });
    }

    const existing = await prisma.user.findUnique({ where: { username } });

    if (existing) {
      // Generate suggestions
      const suggestions = [
        username + Math.floor(Math.random() * 100),
        username + "_" + Math.floor(Math.random() * 100),
        username + new Date().getFullYear(),
      ];
      return res.json({ available: false, suggestions });
    }

    return res.json({ available: true, suggestions: [] });
  } catch (error) {
    console.error("Check Username Error:", error);
    return res.status(500).json({ available: false, suggestions: [] });
  }
}

/**
 * GET /api/v1/auth/check-phone?phone=081234567890
 * Cek apakah nomor HP sudah terdaftar
 */
export async function checkPhone(req: any, res: any) {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.json({ available: false });
    }

    const sanitized = sanitizePhoneNumber(phone);
    if (sanitized.length < 10) {
      return res.json({ available: false });
    }

    const existing = await prisma.user.findUnique({ where: { phone_number: sanitized } });

    return res.json({
      available: !existing,
      registered: !!existing,
    });
  } catch (error) {
    console.error("Check Phone Error:", error);
    return res.status(500).json({ available: false });
  }
}

/**
 * POST /api/v1/auth/register-direct
 * Registrasi langsung tanpa OTP - Akun langsung aktif
 */
export async function registerDirect(req: any, res: any) {
  try {
    const { username, name, phone, phone_number, password, role, latitude, longitude, regionName } = req.body;

    // Validasi input
    const rawPhone = phone_number || phone;

    if (!username || !name || !rawPhone || !password) {
      return res.status(400).json({ success: false, message: "Seluruh kolom wajib diisi!" });
    }
    const sanitizedPhone = sanitizePhoneNumber(rawPhone);

    if (sanitizedPhone.length < 10) {
      return res.status(400).json({ success: false, message: "Format nomor WhatsApp tidak valid." });
    }

    // Validasi format username
    const cleanUsername = username.trim();
    const usernameRegex = /^[a-zA-Z0-9]+$/;
    if (!usernameRegex.test(cleanUsername)) {
      return res.status(400).json({ success: false, message: "Username hanya boleh berisi huruf dan angka tanpa spasi!" });
    }

    // Cek duplikasi Username / Phone
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: cleanUsername }, { phone_number: sanitizedPhone }],
      },
    });

    if (existingUser) {
      const errorMsg = existingUser.username === cleanUsername
        ? "Username sudah digunakan! Silakan cari username lain."
        : "Nomor WhatsApp sudah terdaftar! Silakan login.";
      return res.status(400).json({
        success: false,
        message: errorMsg,
        errorType: existingUser.username === cleanUsername ? "USERNAME_TAKEN" : "PHONE_TAKEN",
      });
    }

    // Generate unique registration code (PK + 6 digit random)
    const registrationCode = `PK${Math.floor(100000 + Math.random() * 900000)}`;

    // Hash Password & Simpan User Baru
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || "PETANI";
    const newUser = await prisma.user.create({
      data: {
        username: cleanUsername,
        name: name || cleanUsername,
        phone_number: sanitizedPhone,
        password: hashedPassword,
        role: userRole,
        registrationCode,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        regionName: regionName || "Wilayah Umum",
      },
    });

    // Generate bot link dengan kode registrasi unik
    const botNumber = process.env.BOT_PHONE_NUMBER || "62895637383173";
    const botLink = `https://wa.me/${botNumber}?text=DAFTAR%20${registrationCode}%20${encodeURIComponent(newUser.name)}`;

    logActivity({
      userId: String(newUser.id),
      role: newUser.role,
      actorPhone: newUser.phone_number,
      actorName: newUser.name,
      action: "USER_REGISTERED_WEB",
      module: "AUTH",
      description: `User "${newUser.username}" (${newUser.role}) berhasil registrasi langsung tanpa OTP.`,
      ipAddress: req.ip,
      userAgent: req.headers?.["user-agent"],
    });

    return res.status(201).json({
      success: true,
      message: "Registrasi berhasil! Akun Anda telah aktif.",
      data: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
        phone: newUser.phone_number,
        registrationCode,
        botLink,
        botNumber,
      },
    });
  } catch (error: any) {
    console.error("Direct Register Error:", error);
    return res.status(500).json({ success: false, message: "Gagal mendaftar akun." });
  }
}

/**
 * POST /api/v1/auth/request-otp
 * Mengirim kode OTP 6-digit ke WhatsApp user untuk verifikasi pendaftaran.
 */
export async function requestOtp(req: any, res: any) {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: "Nomor HP wajib diisi!" });
    }

    const sanitizedPhone = sanitizePhoneNumber(phone);

    if (sanitizedPhone.length < 10 || sanitizedPhone.length > 15) {
      return res.status(400).json({ success: false, message: "Format nomor HP tidak valid." });
    }

    // Cek apakah nomor HP sudah terdaftar di sistem
    const existingUser = await prisma.user.findUnique({ where: { phone_number: sanitizedPhone } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Nomor HP sudah terdaftar. Silakan login." });
    }

    // Generate OTP 6 Digit Random + token unik
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const waToken = `PK${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Berlaku 5 Menit

    // Simpan/Update OTP di Database dengan token
    await prisma.otpVerification.upsert({
      where: { phone: sanitizedPhone },
      update: { code: otpCode, expiresAt, waToken },
      create: { phone: sanitizedPhone, code: otpCode, expiresAt, waToken },
    });

    // Kirim Kode OTP via WA Bot (menggunakan sendHumanLikeWaMessage)
    const sock = getSocket();
    const isDevMode = process.env.NODE_ENV !== "production" || process.env.DEV_MODE === "true";
    const botNumber = process.env.BOT_PHONE_NUMBER || "6281229411387";
    const waMessage = `DAFTAR ${waToken}`;

    let directSent = false;

    if (sock) {
      const waJid = formatToWaJid(sanitizedPhone);
      const otpMsg =
        `🔐 *KODE VERIFIKASI (OTP) PETANIKITA*\n\n` +
        `Kode OTP Anda adalah: *${otpCode}*\n\n` +
        `⚠️ *JANGAN BAGIKAN KODE INI KEPADA SIAPAPUN.*\n` +
        `Kode ini berlaku selama 5 menit untuk verifikasi pendaftaran akun Anda.`;

      // Kirim WA secara non-blocking (fire-and-forget)
      sendHumanLikeWaMessage(sock, waJid, otpMsg)
        .then((success) => {
          directSent = success;
          if (success) {
            console.log(`[OTP] ✓ OTP ${otpCode} terkirim ke ${sanitizedPhone}`);
          } else {
            console.warn(`[OTP] ⚠️ Gagal kirim OTP ke ${sanitizedPhone}`);
          }
        })
        .catch((err) => {
          console.error(`[OTP] ✗ Error kirim OTP ke ${sanitizedPhone}:`, err);
        });
    }

    logActivity({
      actorPhone: sanitizedPhone,
      actorName: "System OTP",
      action: "OTP_REQUESTED",
      module: "AUTH",
      description: `OTP ${otpCode} untuk ${sanitizedPhone}`,
      ipAddress: req.ip,
      userAgent: req.headers?.["user-agent"],
    });

    return res.status(200).json({
      success: true,
      message: directSent
        ? "Kode OTP berhasil dikirimkan ke WhatsApp Anda!"
        : "OTP telah dibuat. Silakan klik tombol WhatsApp di bawah untuk mendapatkan OTP.",
      data: {
        phone: sanitizedPhone,
        waToken,
        botNumber,
        directSent,
        ...(isDevMode ? { otpCode, expiresAt } : {}),
      },
    });
  } catch (error) {
    console.error("Request OTP Error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengirimkan OTP." });
  }
}

/**
 * POST /api/v1/auth/verify-otp
 * Verifikasi kode OTP yang dimasukkan user.
 */
export async function verifyOtp(req: any, res: any) {
  try {
    const { phone, otpCode } = req.body;
    if (!phone || !otpCode) {
      return res.status(400).json({ success: false, message: "Nomor HP dan kode OTP wajib diisi!" });
    }

    const sanitizedPhone = sanitizePhoneNumber(phone);

    const otpRecord = await prisma.otpVerification.findUnique({ where: { phone: sanitizedPhone } });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Kode OTP tidak ditemukan. Silakan request OTP ulang." });
    }

    if (otpRecord.code !== otpCode) {
      return res.status(400).json({ success: false, message: "Kode OTP salah!" });
    }

    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({ success: false, message: "Kode OTP sudah kadaluarsa. Silaka request OTP ulang." });
    }

    return res.status(200).json({
      success: true,
      message: "Kode OTP valid!",
      data: { phone: sanitizedPhone },
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({ success: false, message: "Gagal memverifikasi OTP." });
  }
}

/**
 * POST /api/v1/auth/register-otp
 * Registrasi akun baru dengan verifikasi OTP.
 */
export async function registerWithOtp(req: any, res: any) {
  try {
    const { username, name, phone_number, phone, password, role, otpCode, regionName, business_type, latitude, longitude } = req.body;

    const rawPhone = phone_number || phone;

    // 1. Sanitasi Input
    const sanitizedPhone = sanitizePhoneNumber(rawPhone);
    const cleanUsername = (username || "").trim();

    if (!sanitizedPhone) {
      return res.status(400).json({ success: false, message: "Nomor HP wajib diisi!" });
    }

    if (!cleanUsername) {
      return res.status(400).json({ success: false, message: "Username wajib diisi!" });
    }

    const usernameRegex = /^[a-zA-Z0-9]+$/;
    if (!usernameRegex.test(cleanUsername)) {
      return res.status(400).json({ success: false, message: "Username hanya boleh berisi huruf dan angka tanpa spasi!" });
    }

    // 2. Cek Unik Username
    const existingUsername = await prisma.user.findUnique({ where: { username: cleanUsername } });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: "Username sudah digunakan. Silakan cari username lain.",
        errorType: "USERNAME_TAKEN",
      });
    }

    // 3. Cek Unik Nomor HP
    const existingPhone = await prisma.user.findUnique({ where: { phone_number: sanitizedPhone } });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: "Nomor HP sudah terdaftar. Silakan login.",
        errorType: "PHONE_TAKEN",
      });
    }

    // 4. Verifikasi OTP
    const otpRecord = await prisma.otpVerification.findUnique({ where: { phone: sanitizedPhone } });
    if (!otpRecord || otpRecord.code !== otpCode || new Date() > otpRecord.expiresAt) {
      return res.status(400).json({ success: false, message: "Kode OTP salah atau sudah kadaluarsa!" });
    }

    // 5. Buat User Baru
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        username: cleanUsername,
        name: name || cleanUsername,
        phone_number: sanitizedPhone,
        password: hashedPassword,
        role: role || "PETANI",
        business_type: business_type || null,
        regionName: regionName || "Pusat Operasional",
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
    });

    // Hapus Record OTP setelah berhasil registrasi
    await prisma.otpVerification.delete({ where: { phone: sanitizedPhone } });

    logActivity({
      userId: String(newUser.id),
      role: newUser.role,
      actorPhone: newUser.phone_number,
      actorName: newUser.name,
      action: "USER_REGISTERED_WEB",
      module: "AUTH",
      description: `User "${newUser.username}" (${newUser.role}) berhasil registrasi via Web dengan verifikasi OTP.`,
      ipAddress: req.ip,
      userAgent: req.headers?.["user-agent"],
    });

    return res.status(201).json({
      success: true,
      message: "Registrasi berhasil! Silakan login.",
      data: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
        token: `mock_token_${newUser.id}`,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({ success: false, message: "Gagal mendaftar akun." });
  }
}
