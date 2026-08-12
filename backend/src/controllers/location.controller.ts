import { prisma } from "../lib/prisma.js";
import { logger } from "../utils/logger.js";
import bcrypt from "bcrypt";
import axios from "axios";
import { getSocket } from "../services/whatsapp.service.js";
import { sendHumanLikeWaMessage } from "../services/whatsappBot.service.js";
import { buildPostActivationMenu } from "../services/waBotHandler.js";
import { logActivity } from "../services/auditLog.service.js";

/**
 * Helper untuk mengubah Latitude & Longitude menjadi Nama Kabupaten/Kota riil
 */
async function getRealRegionName(lat: number, lng: number): Promise<string> {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { "User-Agent": "PetaniKita-App/1.0" }, timeout: 4000 }
    );

    const address = response.data?.address;
    if (address) {
      const regency =
        address.city_district ||
        address.county ||
        address.city ||
        address.state_district ||
        address.town;
      const state = address.state || "";

      if (regency) {
        const regencyLower = regency.toLowerCase();
        if (regencyLower.includes("kabupaten") || regencyLower.includes("kota")) {
          return regency;
        }
        return `Kabupaten ${regency}`;
      }
      if (state) {
        return state;
      }
    }
    return "Kabupaten Purbalingga";
  } catch (error) {
    console.error("[GEOCODING] Reverse Geocoding Error/Timeout:", error instanceof Error ? error.message : error);
    try {
      const sampleUser = await prisma.user.findFirst({
        where: { regionName: { not: null } },
        select: { regionName: true },
      });
      if (sampleUser?.regionName) {
        return sampleUser.regionName;
      }
    } catch {
      // ignore db error fallback
    }
    return "Kabupaten Purbalingga";
  }
}

/**
 * Verify token & save location from WA share link (basic version without password)
 */
export async function updateLocationFromWaToken(req: any, res: any) {
  try {
    const { token, latitude, longitude, regionName } = req.body;

    if (!token || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: "Token dan koordinat lokasi wajib diisi." });
    }

    const waReg = await prisma.waRegistration.findFirst({
      where: { waLid: token },
    });

    if (!waReg) {
      return res.status(404).json({ success: false, message: "Sesi pendaftaran tidak ditemukan atau token telah kadaluarsa." });
    }

    const userPhone = waReg.phone || "0000000";
    const userRole = (waReg.role as any) || "PETANI";
    const updatedUser = await prisma.user.upsert({
      where: { phone_number: userPhone },
      update: {
        latitude: Number(latitude),
        longitude: Number(longitude),
        regionName: regionName || "Wilayah Terdaftar WA",
      },
      create: {
        username: (waReg.name || "mitrawa").replace(/[^a-zA-Z0-9]/g, "").toLowerCase() + Date.now(),
        name: waReg.name || "Mitra WA",
        phone_number: userPhone,
        role: userRole,
        latitude: Number(latitude),
        longitude: Number(longitude),
        regionName: regionName || "Wilayah Terdaftar WA",
      },
    });

    logger.info({ action: "LOCATION_UPDATED", user: updatedUser.name, region: updatedUser.regionName }, `[LOCATION] Lokasi berhasil diperbarui untuk ${updatedUser.name}`);

    logActivity({
      userId: updatedUser.id,
      role: updatedUser.role,
      actorPhone: updatedUser.phone_number,
      actorName: updatedUser.name,
      action: "LOCATION_UPDATED",
      module: "LOCATION",
      description: `Pengguna "${updatedUser.name}" memperbarui titik lokasi GPS ke ${updatedUser.regionName} (${latitude}, ${longitude}) melalui link share lokasi WhatsApp.`,
      ipAddress: req.ip,
      userAgent: req.headers?.["user-agent"],
    });

    return res.status(200).json({
      success: true,
      message: "Lokasi Anda berhasil diperbarui!",
      data: { name: updatedUser.name, region: updatedUser.regionName },
    });
  } catch (error) {
    console.error("Error updating location from WA:", error);
    return res.status(500).json({ success: false, message: "Gagal memperbarui lokasi." });
  }
}

/**
 * Activate WA account: reverse geocode location + set bcrypt password
 */
export async function updateLocationAndPasswordFromWa(req: any, res: any) {
  try {
    const { token, latitude, longitude, password } = req.body;

    if (!token || latitude === undefined || longitude === undefined || !password) {
      return res.status(400).json({
        success: false,
        message: "Token, koordinat lokasi, dan password wajib diisi.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password minimal terdiri dari 6 karakter.",
      });
    }

    // 1. Cari data pendaftaran WA berdasarkan token/LID
    const waReg = await prisma.waRegistration.findFirst({
      where: { waLid: token },
    });

    if (!waReg || !waReg.phone) {
      return res.status(404).json({
        success: false,
        message: "Sesi pendaftaran tidak ditemukan. Silakan lakukan pendaftaran ulang via WA.",
      });
    }

    // 2. Dapatkan nama wilayah administratif riil dari koordinat GPS
    const realRegion = await getRealRegionName(Number(latitude), Number(longitude));

    // 3. Hash Password dengan Bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Update / Upsert ke Tabel Utama Users
    const userRole = (waReg.role as any) || "PETANI";
    const updatedUser = await prisma.user.upsert({
      where: { phone_number: waReg.phone },
      update: {
        latitude: Number(latitude),
        longitude: Number(longitude),
        regionName: realRegion,
        password: hashedPassword,
      },
      create: {
        username: (waReg.name || "mitrapetankita").replace(/[^a-zA-Z0-9]/g, "").toLowerCase() + Date.now(),
        name: waReg.name || "Mitra PetaniKita",
        phone_number: waReg.phone,
        role: userRole,
        latitude: Number(latitude),
        longitude: Number(longitude),
        regionName: realRegion,
        password: hashedPassword,
      },
    });

    // 5. Tandai pendaftaran WA selesai & akun aktif
    await prisma.waRegistration.update({
      where: { id: waReg.id },
      data: { isRegistered: true, step: "COMPLETED", pendingDraft: null },
    });

    logger.info(
      { action: "ACCOUNT_ACTIVATED", user: updatedUser.name, region: realRegion },
      `[LOCATION] Akun aktif untuk ${updatedUser.name} di wilayah ${realRegion}`
    );

    logActivity({
      userId: updatedUser.id,
      role: updatedUser.role,
      actorPhone: updatedUser.phone_number,
      actorName: updatedUser.name,
      action: "LOCATION_ACTIVATED",
      module: "LOCATION",
      description: `Akun "${updatedUser.name}" (${updatedUser.role}) AKTIF 100% — lokasi GPS terkunci di ${realRegion} (${latitude}, ${longitude}) dan password login Web berhasil dibuat.`,
      ipAddress: req.ip,
      userAgent: req.headers?.["user-agent"],
    });

    // 6. NOTIFIKASI AUTO-KONFIRMASI KE WA BAHWA AKUN SUDAH AKTIF 100%
    const sock = getSocket();
    const waTarget = waReg.waJid || waReg.waLid;
    if (sock && waTarget) {
      const activeSuccessMsg =
        `🎉 *AKUN ANDA TELAH AKTIF 100%!* 🎉\n\n` +
        `Halo Pak/Bu *${updatedUser.name}*,\n` +
        `Lokasi ladang/toko Anda di *${updatedUser.regionName}* dan password Web Anda telah berhasil disimpan.\n\n` +
        buildPostActivationMenu(waReg.role ?? updatedUser.role, updatedUser.name);

      sendHumanLikeWaMessage(sock, waTarget, activeSuccessMsg)
        .then(() => console.log(`[WA BOT] Notifikasi aktivasi terkirim ke ${waTarget}`))
        .catch(err => console.error("❌ Failed to send WA activation confirmation:", err));
    }

    return res.status(200).json({
      success: true,
      message: "Aktivasi akun dan lokasi berhasil disimpan!",
      data: {
        name: updatedUser.name,
        regionName: updatedUser.regionName,
        phone: updatedUser.phone_number,
      },
    });
  } catch (error) {
    console.error("Error activating WA account:", error);
    return res.status(500).json({ success: false, message: "Gagal memperbarui profil lokasi dan password." });
  }
}
