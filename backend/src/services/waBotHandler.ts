import { WASocket, proto } from "@whiskeysockets/baileys";
import { prisma } from "../lib/prisma.js";
import { sanitizePhoneTo62, formatToWaJid } from "../utils/phoneSanitizer.js";
import { parseFarmerMessageWithAI } from "./aiMessageParser.service.js";
import { sendHumanLikeWaMessage } from "./whatsappBot.service.js";
import { rejectOrderWithReason } from "../controllers/procurement.controller.js";
import { logActivity } from "./auditLog.service.js";
import { scrapePriceAI } from "./priceScraperAI.service.js";

const FRONTEND_URL = (process.env.FRONTEND_URL || "https://xc4v9xjv-3000.asse.devtunnels.ms").replace(/\/$/, "");

const ROLE_BY_INPUT: Record<string, string> = {
  "1": "PETANI",
  "2": "UMKM",
};

export function buildWelcomeMessage(_senderLid?: string): string {
  return (
    `Selamat Datang di *PetaniKita*! 🌾\n\n` +
    `Sistem mendeteksi nomor Anda belum terdaftar atau belum login.\n\n` +
    `Silakan balas dengan pilihan angka berikut:\n` +
    `1️⃣ *Daftar Akun Baru*\n` +
    `2️⃣ *Login ke Akun Existing*\n` +
    `3️⃣ *Bantuan / Informasi*\n\n` +
    `💡 *Sudah punya kode registrasi?*\n` +
    `Kirim format: *DAFTAR [KodeAnda]*\n` +
    `Contoh: *DAFTAR PK123456*\n\n` +
    `_Ketik angka 1 untuk mendaftar atau 2 untuk login._`
  );
}

export function buildRoleMenuMessage(): string {
  return (
    `🌾 *PENDAFTARAN MITRA PETANIKITA*\n\n` +
    `Silakan pilih Peran / Role Anda dengan membalas *ANGKA*:\n\n` +
    `1️⃣ *PETANI* (Produsen & Penjual Hasil Panen)\n` +
    `2️⃣ *UMKM KULINER* (Restoran / Warung / Pembeli)\n\n` +
    `_Ketik angka 1 atau 2_`
  );
}

function buildShareLocationLink(senderLid: string): string {
  return `${FRONTEND_URL}/share-location?token=${encodeURIComponent(senderLid)}`;
}

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

/** Format tanggal & jam WIB */
const wibDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const wibDateTime = (d: Date | string) =>
  new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB";

const GREETING_KEYWORDS = [
  "p", "pp", "halo", "hallo", "hai", "hi", "hey", "ping", "bot", "menu",
  "assalamualaikum", "assalamu'alaikum", "permisi", "pagi", "siang", "sore", "malam",
  "start", "mulai", "info",
];

export const MAX_RADIUS_KM = 50;

/**
 * Normalisasi role dari DB/registrasi ke 2 kanal P2P: PETANI | UMKM
 */
export function normalizeRole(rawRole?: string | null): "PETANI" | "UMKM" {
  const r = (rawRole || "").toUpperCase();
  if (r === "UMKM") return "UMKM";
  return "PETANI";
}

/**
 * Menu utama sesuai peran pengguna
 */
export function buildPostActivationMenu(rawRole?: string | null, userName?: string | null): string {
  const role = normalizeRole(rawRole);
  const name = userName || "Mitra";

  if (role === "UMKM") {
    return (
      `👨‍🍳 *MENU UTAMA UMKM KULINER (PETANIKITA)* 👨‍🍳\n\n` +
      `Halo Kak *${name}*,\n` +
      `Silakan ketik *ANGKA* atau *KEYWORD* berikut:\n\n` +
      `1️⃣ 🛒 *Cari & Pesan Bahan Baku Terdekat* (<${MAX_RADIUS_KM} km) — ketik *RESTOCK*\n` +
      `2️⃣ 🚚 *Cek Status Pesanan Saya* — ketik *PESANAN*\n` +
      `3️⃣ 🤖 *Cek Rekomendasi Restock AI* — ketik *REKOMENDASI*\n` +
      `4️⃣ 📊 *Cek Harga Pasar Regional* — ketik *HARGA*\n\n` +
      `🌐 Dashboard Web: ${FRONTEND_URL}/dashboard/procurement`
    );
  }

  return (
    `🌾 *MENU UTAMA PETANI (PETANIKITA)* 🌾\n\n` +
    `Halo Pak/Bu *${name}*,\n` +
    `Silakan ketik *ANGKA* atau *KEYWORD* berikut:\n\n` +
    `1️⃣ 🌾 *Jual / Input Panen Baru* — ketik *PANEN*\n` +
    `2️⃣ 📦 *Cek Status Hasil Panen Saya* — ketik *STATUS*\n` +
    `3️⃣ 📊 *Cek Harga Pasar Regional* — ketik *HARGA*\n` +
    `4️⃣ 📞 *Hubungi Layanan Bantuan* — ketik *BANTUAN*\n\n` +
    `💡 *Tips:* Anda bisa langsung ketik: _"Ada panen cabai rawit 100 kg harga 28rb"_\n` +
    `AI kami akan otomatis memprosesnya!`
  );
}

/**
 * Cari user terdaftar berdasarkan nomor pada waRegistration (toleran format 08.. / 62..)
 */
async function findLinkedUser(phone: string | null) {
  if (!phone) return null;
  const digits = sanitizePhoneTo62(phone);
  const localFormat = digits.startsWith("62") ? "0" + digits.slice(2) : digits;
  return prisma.user.findFirst({
    where: { OR: [{ phone_number: digits }, { phone_number: localFormat }, { phone_number: phone }] },
  });
}

/**
 * Simpan hasil panen ke DB sesuai skema riil: FarmCrop -> HarvestEvent (+ PriceHistory)
 */
async function persistHarvestFromAI(
  user: { id: number; latitude: number; longitude: number; regionName: string | null },
  commodityName: string,
  quantityKg: number,
  pricePerKg: number,
  harvestDate?: Date,
  deliveryReadyDate?: Date
) {
  const crop = await prisma.farmCrop.create({
    data: {
      user_id: user.id,
      crop_type: commodityName,
      area_size_m2: 0,
      latitude: user.latitude ?? -7.7558,
      longitude: user.longitude ?? 110.4052,
      regionName: user.regionName,
    },
  });

  const harvest = await prisma.harvestEvent.create({
    data: {
      crop_id: crop.id,
      est_harvest_date: harvestDate ?? new Date(),
      est_yield_kg: quantityKg,
      price_per_kg: pricePerKg,
      delivery_ready_date: deliveryReadyDate ?? harvestDate ?? new Date(),
      status: "AVAILABLE",
    },
  });

  // Catat harga lapangan petani agar muncul di price engine regional
  if (user.regionName && pricePerKg > 0) {
    await prisma.priceHistory.upsert({
      where: { regionName_commodity: { regionName: user.regionName, commodity: commodityName } },
      update: {
        farmer_price: pricePerKg,
        umkm_price: Math.round(pricePerKg * 1.2),
        hap_price: Math.round(pricePerKg * 1.15),
      },
      create: {
        regionName: user.regionName,
        commodity: commodityName,
        farmer_price: pricePerKg,
        prev_price: pricePerKg,
        umkm_price: Math.round(pricePerKg * 1.2),
        hap_price: Math.round(pricePerKg * 1.15),
        trend: "STABLE",
      },
    });
  }

  return harvest;
}

type LinkedUser = Awaited<ReturnType<typeof findLinkedUser>>;

/**
 * Kirim harga pasar regional riil dari DB
 */
async function sendRegionalPrices(sock: WASocket, remoteJid: string, regionName: string | null) {
  const prices = await prisma.priceHistory.findMany({
    where: regionName ? { regionName } : {},
    orderBy: { updated_at: "desc" },
    take: 6,
  });

  if (prices.length === 0) {
    await sock.sendMessage(remoteJid, {
      text: `📊 *HARGA PASAR REGIONAL*\n\nData harga untuk wilayah Anda sedang dikumpulkan oleh AI Price Engine. Silakan coba beberapa saat lagi.`,
    });
    return;
  }

  const lines = prices
    .map(p => {
      const icon = p.trend === "UP" ? "🔺" : p.trend === "DOWN" ? "🔻" : "➖";
      return `${icon} ${p.commodity}: *${rupiah(p.farmer_price)}*/Kg`;
    })
    .join("\n");

  await sock.sendMessage(remoteJid, {
    text:
      `📊 *HARGA PASAR HARI INI*\n` +
      `_Wilayah: ${prices[0].regionName}_\n\n${lines}\n\n` +
      `_Harga bersumber dari AI Price Engine PetaniKita._`,
  });
}

/**
 * PETANI: status stok panen + pesanan masuk
 */
async function sendFarmerHarvestStatus(sock: WASocket, remoteJid: string, user: LinkedUser) {
  if (!user) {
    await sock.sendMessage(remoteJid, { text: `⚠️ Data akun tidak ditemukan. Hubungi admin PetaniKita.` });
    return;
  }

  const crops = await prisma.farmCrop.findMany({
    where: { user_id: user.id },
    include: { harvests: true },
    orderBy: { id: "desc" },
    take: 10,
  });

  const harvests = crops.flatMap(c => c.harvests.map(h => ({ crop: c.crop_type, h })));

  if (harvests.length === 0) {
    await sock.sendMessage(remoteJid, {
      text: `📦 *STATUS HASIL PANEN SAYA*\n\nBelum ada data panen.\n\n_Ketik *PANEN* untuk menginput hasil panen pertama Anda._`,
    });
    return;
  }

  const orders = await prisma.umkmOrder.findMany({
    where: { harvest_event: { crop_id: { in: crops.map(c => c.id) } } },
    include: { umkm_user: true, harvest_event: { include: { crop: true } } },
    orderBy: { created_at: "desc" },
    take: 5,
  });

  const stockLines = harvests
    .slice(0, 6)
    .map(({ crop, h }) => {
      const icon = h.status === "AVAILABLE" ? "🟢" : h.status === "SOLD" ? "✅" : "🔒";
      return `${icon} #${h.id} ${crop} — ${h.est_yield_kg} Kg (*${h.status}*)`;
    })
    .join("\n");

  const orderLines =
    orders.length > 0
      ? orders
          .map(
            o =>
              `• *#${o.id}* ${o.harvest_event?.crop?.crop_type ?? "Komoditas"} — ${o.amount_kg} Kg\n` +
              `  Pembeli: ${o.umkm_user?.name ?? "UMKM"} | ${rupiah(o.grand_total ?? o.total_amount)}\n` +
              `  Status: *${o.status}*`
          )
          .join("\n\n")
      : "_Belum ada pesanan masuk._";

  await sock.sendMessage(remoteJid, {
    text:
      `📦 *STATUS HASIL PANEN SAYA*\n\n` +
      `*Stok di Radar:*\n${stockLines}\n\n` +
      `*Pesanan Masuk:*\n${orderLines}`,
  });
}

/**
 * UMKM: daftar supplier petani terdekat dalam radius MAX_RADIUS_KM
 */
async function sendUmkmSuppliers(sock: WASocket, remoteJid: string, user: LinkedUser) {
  if (!user) {
    await sock.sendMessage(remoteJid, { text: `⚠️ Data akun tidak ditemukan. Hubungi admin PetaniKita.` });
    return;
  }

  const suppliers = await prisma.$queryRaw<
    { harvestId: number; farmerName: string; commodityName: string; stockKg: number; distanceKm: number }[]
  >`
    SELECT h.id AS harvestId, u.name AS farmerName, fc.crop_type AS commodityName,
           h.est_yield_kg AS stockKg,
           ROUND(ST_Distance_Sphere(Point(u.longitude, u.latitude), Point(${user.longitude ?? 110.4052}, ${user.latitude ?? -7.7558})) / 1000, 1) AS distanceKm
    FROM harvest_events h
    JOIN farm_crops fc ON h.crop_id = fc.id
    JOIN users u ON fc.user_id = u.id
    WHERE h.status = 'AVAILABLE' AND h.est_yield_kg > 0
      AND ST_Distance_Sphere(Point(u.longitude, u.latitude), Point(${user.longitude ?? 110.4052}, ${user.latitude ?? -7.7558})) / 1000 <= ${MAX_RADIUS_KM}
    ORDER BY distanceKm ASC
    LIMIT 5
  `;

  if (suppliers.length === 0) {
    await sock.sendMessage(remoteJid, {
      text:
        `🛒 *BAHAN BAKU TERDEKAT (<${MAX_RADIUS_KM} km)*\n\n` +
        `Belum ada stok panen aktif di radius Anda saat ini.\n\n` +
        `🌐 Cek berkala di Dashboard:\n👉 ${FRONTEND_URL}/dashboard/procurement`,
    });
    return;
  }

  const lines = suppliers
    .map(
      s =>
        `• *${s.commodityName}* — ${s.stockKg} Kg\n` +
        `  Petani: ${s.farmerName} (${Number(s.distanceKm)} km)`
    )
    .join("\n\n");

  await sock.sendMessage(remoteJid, {
    text:
      `🛒 *BAHAN BAKU TERDEKAT (<${MAX_RADIUS_KM} km)*\n\n${lines}\n\n` +
      `Untuk memesan & mengunci harga, buka Dashboard:\n👉 ${FRONTEND_URL}/dashboard/procurement`,
  });
}

/**
 * UMKM: status pesanan
 */
async function sendUmkmOrders(sock: WASocket, remoteJid: string, user: LinkedUser) {
  if (!user) {
    await sock.sendMessage(remoteJid, { text: `⚠️ Data akun tidak ditemukan. Hubungi admin PetaniKita.` });
    return;
  }

  const orders = await prisma.umkmOrder.findMany({
    where: { umkm_user_id: user.id },
    include: { harvest_event: { include: { crop: { include: { user: true } } } } },
    orderBy: { created_at: "desc" },
    take: 5,
  });

  if (orders.length === 0) {
    await sock.sendMessage(remoteJid, {
      text: `🚚 *STATUS PESANAN SAYA*\n\nBelum ada pesanan.\n\n_Ketik *RESTOCK* untuk mencari bahan baku terdekat._`,
    });
    return;
  }

  const lines = orders
    .map(
      o =>
        `• *#${o.id}* ${o.harvest_event?.crop?.crop_type ?? "Komoditas"} — ${o.amount_kg} Kg\n` +
        `  Petani: ${o.harvest_event?.crop?.user?.name ?? "-"}\n` +
        `  Total: ${rupiah(o.grand_total ?? o.total_amount)} | Status: *${o.status}*`
    )
    .join("\n\n");

  await sock.sendMessage(remoteJid, {
    text: `🚚 *STATUS PESANAN SAYA*\n\n${lines}\n\n🌐 Detail: ${FRONTEND_URL}/dashboard/procurement/history`,
  });
}

/**
 * PETANI membalas ACC / TOLAK#Alasan atas pesanan yang menunggu konfirmasi.
 * Return true jika pesan sudah ditangani.
 */
async function handleFarmerOrderResponse(
  sock: WASocket,
  remoteJid: string,
  user: LinkedUser,
  cleanBody: string
): Promise<boolean> {
  if (!user) return false;

  const upper = cleanBody.toUpperCase().trim();
  const isAccept = ["ACC", "TERIMA", "SETUJU", "OK ORDER"].includes(upper);
  const isReject = upper.startsWith("TOLAK");
  if (!isAccept && !isReject) return false;

  const activeOrder = await prisma.umkmOrder.findFirst({
    where: {
      harvest_event: { crop: { user_id: user.id } },
      status: { in: ["PENDING_FARMER_CONFIRMATION", "WAITING_FARMER_NEGO_APPROVAL"] },
    },
    include: {
      umkm_user: true,
      harvest_event: { include: { crop: true } },
    },
    orderBy: { created_at: "desc" },
  });

  if (!activeOrder) {
    await sock.sendMessage(remoteJid, {
      text: `ℹ️ Tidak ada pesanan yang menunggu konfirmasi Anda saat ini.\n\n_Ketik *STATUS* untuk melihat stok & pesanan._`,
    });
    return true;
  }

  const commodity = activeOrder.harvest_event?.crop?.crop_type ?? "Komoditas";
  const umkmPhone = activeOrder.umkm_user?.phone_number ?? "";

  if (isAccept) {
    await prisma.umkmOrder.update({
      where: { id: activeOrder.id },
      data: { status: "ACCEPTED" },
    });

    const methodLabel =
      activeOrder.delivery_method === "COD_AMBIL_SENDIRI"
        ? `UMKM akan *mengambil sendiri* ke ladang Anda (COD)`
        : `Anda *mengantar* pesanan ini (ongkir ${rupiah(activeOrder.delivery_fee ?? 0)})`;

    await sock.sendMessage(remoteJid, {
      text:
        `✅ *PESANAN #${activeOrder.id} DISETUJUI!*\n\n` +
        `• Komoditas: *${commodity}*\n` +
        `• Kuantitas: *${activeOrder.amount_kg} Kg*\n` +
        `• Harga: *${rupiah(activeOrder.price_per_kg ?? 0)}*/Kg\n` +
        `• Total Diterima: *${rupiah(activeOrder.grand_total ?? activeOrder.total_amount)}*\n\n` +
        `📌 ${methodLabel}.\n\n` +
        `📲 Hubungi Pembeli: https://wa.me/${sanitizePhoneTo62(umkmPhone)}`,
    });

    if (umkmPhone) {
      const umkmMsg =
        `🎉 *PESANAN ANDA DISETUJUI PETANI!* 🎉\n\n` +
        `Petani *${user.name}* menyetujui pesanan *${commodity}* (${activeOrder.amount_kg} Kg).\n` +
        `• Harga: ${rupiah(activeOrder.price_per_kg ?? 0)}/Kg\n` +
        `• Total: ${rupiah(activeOrder.grand_total ?? activeOrder.total_amount)}\n` +
        `• Metode: ${activeOrder.delivery_method === "COD_AMBIL_SENDIRI" ? "Ambil Sendiri ke Ladang (COD)" : "Diantar Petani"}\n\n` +
        `📲 Hubungi Petani: https://wa.me/${sanitizePhoneTo62(user.phone_number)}`;
      sendHumanLikeWaMessage(sock, formatToWaJid(umkmPhone), umkmMsg).catch(() => {});
    }

    logActivity({
      userId: user.id,
      role: user.role,
      actorPhone: user.phone_number,
      actorName: user.name,
      action: "ORDER_ACCEPTED",
      module: "ORDER",
      description: `Petani "${user.name}" MENYETUJUI order #${activeOrder.id} via Bot WhatsApp: ${commodity} ${activeOrder.amount_kg} Kg @ ${rupiah(activeOrder.price_per_kg ?? 0)}/Kg dari UMKM "${activeOrder.umkm_user?.name ?? "-"}". Total ${rupiah(activeOrder.grand_total ?? activeOrder.total_amount)}.`,
      userAgent: "WhatsApp Bot",
    });

    console.log(`   ✅ Order #${activeOrder.id} di-ACC petani ${user.name}.`);
    return true;
  }

  // TOLAK#Alasan — atomic: ubah status + kembalikan stok
  const parts = cleanBody.split("#");
  let rejectionReason: string;
  try {
    const result = await rejectOrderWithReason(activeOrder.id, parts[1] || "");
    rejectionReason = result.reason;
  } catch (err) {
    await sock.sendMessage(remoteJid, {
      text: `⚠️ ${err instanceof Error ? err.message : "Gagal memproses penolakan."}`,
    });
    return true;
  }

  await sock.sendMessage(remoteJid, {
    text:
      `❌ *PESANAN #${activeOrder.id} DITOLAK.*\n\n` +
      `Alasan Anda telah diteruskan secara transparan ke UMKM:\n"${rejectionReason}"\n\n` +
      `Stok *${activeOrder.amount_kg} Kg ${commodity}* telah dikembalikan ke Radar PetaniKita.`,
  });

  if (umkmPhone) {
    const rejectionMsg =
      `❌ *PESANAN DITOLAK OLEH PETANI*\n\n` +
      `Mohon maaf, pesanan *${commodity}* (${activeOrder.amount_kg} Kg) Anda ditolak oleh Pak/Bu *${user.name}*.\n\n` +
      `💬 *Alasan Penolakan Petani:*\n"${rejectionReason}"\n\n` +
      `Stok telah dikembalikan. Silakan pilih opsi petani terdekat lainnya di Web PetaniKita:\n` +
      `👉 ${FRONTEND_URL}/dashboard/procurement`;
    sendHumanLikeWaMessage(sock, formatToWaJid(umkmPhone), rejectionMsg).catch(() => {});
  }

  logActivity({
    userId: user.id,
    role: user.role,
    actorPhone: user.phone_number,
    actorName: user.name,
    action: "ORDER_REJECTED",
    module: "ORDER",
    description: `Petani "${user.name}" MENOLAK order #${activeOrder.id} via Bot WhatsApp: ${commodity} ${activeOrder.amount_kg} Kg dari UMKM "${activeOrder.umkm_user?.name ?? "-"}". Alasan: "${rejectionReason}". Stok dikembalikan ke radar.`,
    userAgent: "WhatsApp Bot",
  });

  console.log(`   ❌ Order #${activeOrder.id} ditolak petani ${user.name}: "${rejectionReason}"`);
  return true;
}

/**
 * Pesan bantuan sesuai peran
 */
async function sendHelpMessage(sock: WASocket, remoteJid: string, role: "PETANI" | "UMKM") {
  const tips =
    role === "PETANI"
      ? `• Ketik *PANEN* untuk input hasil panen\n• Ketik *STATUS* untuk cek stok & pesanan\n• Ketik *HARGA* untuk cek harga pasar\n\nAnda juga bisa langsung mengetik:\n_"panen tomat 80 kg harga 12rb"_`
      : `• Ketik *RESTOCK* untuk cari bahan baku terdekat\n• Ketik *PESANAN* untuk cek status pesanan\n• Ketik *HARGA* untuk cek harga pasar`;

  await sock.sendMessage(remoteJid, {
    text:
      `📞 *LAYANAN BANTUAN PETANIKITA*\n\n${tips}\n\n` +
      `Butuh bantuan manusia? Balas dengan keluhan Anda, tim kami akan menghubungi.`,
  });
}

/**
 * Handler untuk user yang akunnya sudah aktif (COMPLETED / isRegistered)
 */
async function handleActiveUserMessage(
  sock: WASocket,
  remoteJid: string,
  senderLid: string,
  waReg: { phone: string | null; name: string | null; role: string | null; pendingDraft: string | null },
  cleanBody: string
) {
  const upper = cleanBody.toUpperCase();

  // A0. KONFIRMASI PESANAN P2P (ACC / TOLAK#Alasan) — prioritas tertinggi
  const upperTrim = upper.trim();
  if (upperTrim === "ACC" || upperTrim === "TERIMA" || upperTrim === "SETUJU" || upperTrim.startsWith("TOLAK")) {
    const farmerUser = await findLinkedUser(waReg.phone);
    if (farmerUser && normalizeRole(farmerUser.role) === "PETANI") {
      const handled = await handleFarmerOrderResponse(sock, remoteJid, farmerUser, cleanBody);
      if (handled) return;
    }
  }

  // A. KONFIRMASI DRAFT PANEN YANG TERTUNDA
  if (waReg.pendingDraft) {
    const draft = JSON.parse(waReg.pendingDraft) as {
      commodityName: string;
      quantityKg: number;
      pricePerKg: number;
      harvestDate?: string;
      deliveryReadyDate?: string;
      scheduleLabel?: string;
      latitude?: number | null;
      longitude?: number | null;
      regionName?: string | null;
    };

    if (["YA", "Y", "OK", "OKE", "IYA", "BENAR", "SETUJU"].includes(upper)) {
      const user = await findLinkedUser(waReg.phone);
      if (!user) {
        await prisma.waRegistration.update({ where: { waLid: senderLid }, data: { pendingDraft: null } });
        await sock.sendMessage(remoteJid, {
          text: `⚠️ Akun Anda belum lengkap. Mohon selesaikan aktivasi lokasi terlebih dahulu:\n👉 ${buildShareLocationLink(senderLid)}`,
        });
        return;
      }

      const harvest = await persistHarvestFromAI(
        {
          ...user,
          latitude: draft.latitude ?? user.latitude ?? -7.7558,
          longitude: draft.longitude ?? user.longitude ?? 110.4052,
          regionName: draft.regionName ?? user.regionName,
        },
        draft.commodityName,
        draft.quantityKg,
        draft.pricePerKg,
        draft.harvestDate ? new Date(draft.harvestDate) : undefined,
        draft.deliveryReadyDate ? new Date(draft.deliveryReadyDate) : undefined
      );

      await prisma.waRegistration.update({ where: { waLid: senderLid }, data: { pendingDraft: null } });

      logActivity({
        userId: user.id,
        role: user.role,
        actorPhone: user.phone_number,
        actorName: user.name,
        action: "PANEN_POSTED",
        module: "HARVEST",
        description: `Petani "${user.name}" menerbitkan panen #${harvest.id} via Bot WhatsApp: ${draft.commodityName} ${draft.quantityKg} Kg @ ${rupiah(draft.pricePerKg)}/Kg di ${user.regionName ?? "-"}. Ready: ${harvest.delivery_ready_date ? wibDateTime(harvest.delivery_ready_date) : "-"}.`,
        userAgent: `WhatsApp Bot (LID: ${senderLid})`,
      });

      await sock.sendMessage(remoteJid, {
        text:
          `✅ *PANEN BERHASIL TERBIT DI RADAR PETANIKITA!* 🌾\n\n` +
          `• *ID Panen:* #${harvest.id}\n` +
          `• *Komoditas:* ${draft.commodityName}\n` +
          `• *Kuantitas:* ${draft.quantityKg} Kg\n` +
          `• *Harga Lapangan:* ${rupiah(draft.pricePerKg)} / Kg\n` +
          `• *Lokasi:* ${user.regionName ?? "-"}\n` +
          `• *Tanggal Panen:* ${wibDate(harvest.est_harvest_date)}\n` +
          `• *Ready Diantar/Diambil:* ${harvest.delivery_ready_date ? wibDateTime(harvest.delivery_ready_date) : "-"}\n` +
          `• *Diupload:* ${wibDateTime(harvest.uploaded_at)}\n\n` +
          `📡 *Status:* Terbit & Siap Dipesan oleh UMKM Kuliner terdekat (<50 km).`,
      });
      console.log(`   ✅ Panen #${harvest.id} tersimpan dari WA (${draft.commodityName} ${draft.quantityKg}kg).`);
      return;
    }

    if (["BATAL", "TIDAK", "N", "NO", "CANCEL"].includes(upper)) {
      await prisma.waRegistration.update({ where: { waLid: senderLid }, data: { pendingDraft: null } });
      await sock.sendMessage(remoteJid, {
        text: `❌ Input panen dibatalkan.\n\nSilakan kirim ulang detail panen Anda kapan saja.`,
      });
      return;
    }

    await sock.sendMessage(remoteJid, {
      text:
        `⚠️ Mohon konfirmasi input panen Anda terlebih dahulu.\n\n` +
        `• ${draft.commodityName} — ${draft.quantityKg} Kg — ${rupiah(draft.pricePerKg)}/Kg\n\n` +
        `Ketik *YA* untuk menerbitkan, atau *BATAL* untuk membatalkan.`,
    });
    return;
  }

  // B. ROUTING BERBASIS PERAN + KEYWORD TRIGGER
  const user = await findLinkedUser(waReg.phone);
  const role = normalizeRole(user?.role ?? waReg.role);
  const userName = user?.name || waReg.name || "Mitra";
  const lower = cleanBody.toLowerCase();

  const isGreeting = GREETING_KEYWORDS.includes(lower);
  const matches = (keywords: string[], ...numbers: string[]) =>
    keywords.includes(lower) || numbers.includes(cleanBody);

  // --- Keyword universal: KEMBALI KE MENU UTAMA (0 atau MENU) ---
  if (cleanBody === "0" || matches(["menu", "utama", "home", "balik", "kembali"])) {
    await sock.sendMessage(remoteJid, { text: buildPostActivationMenu(role, userName) });
    console.log(`   📤 Menu ${role} dikirim ke ${senderLid} (via keyword 0/MENU).`);
    return;
  }

  // --- Keyword universal: HARGA ---
  if (matches(["harga", "cek harga", "harga pasar", "pasar"], role === "UMKM" ? "4" : "3")) {
    await sendRegionalPrices(sock, remoteJid, user?.regionName ?? null);
    return;
  }

  // --- Keyword universal: MENU ---
  if (isGreeting) {
    await sock.sendMessage(remoteJid, { text: buildPostActivationMenu(role, userName) });
    console.log(`   📤 Menu ${role} dikirim ke ${senderLid}.`);
    return;
  }

  // ================= ROLE: PETANI =================
  if (role === "PETANI") {
    if (matches(["panen", "jual", "input panen"], "1")) {
      await sock.sendMessage(remoteJid, {
        text:
          `🌾 *INPUT HASIL PANEN BARU*\n\n` +
          `Silakan ketik detail panen Anda dengan bahasa sehari-hari.\n\n` +
          `📌 *Contoh Penulisan Lengkap:*\n` +
          `• _"Ada panen cabai rawit 300 kg harga 20k per kg siap panen tanggal 11 agustus siap antar tanggal 13"_\n` +
          `• _"Panen Bawang Merah 2 kuintal harga 28rb sekilo siap panen besok ready kirim lusa"_\n` +
          `• _"Ada panen tomat 150 kg harga 12000 ready dipanen dan antar hari ini"_\n\n` +
          `🤖 *Sistem AI PetaniKita akan otomatis membaca komoditas, berat, harga, serta jadwal tanggal panen & kirim Anda!*`,
      });
      return;
    }

    if (matches(["status", "panen saya", "stok"], "2")) {
      await sendFarmerHarvestStatus(sock, remoteJid, user);
      return;
    }

    if (matches(["bantuan", "admin", "help", "cs"], "4")) {
      await sendHelpMessage(sock, remoteJid, role);
      return;
    }
  }

  // ================= ROLE: UMKM =================
  if (role === "UMKM") {
    if (matches(["restock", "pesan", "beli", "bahan baku"], "1")) {
      await sendUmkmSuppliers(sock, remoteJid, user);
      return;
    }

    if (matches(["pesanan", "order", "status"], "2")) {
      await sendUmkmOrders(sock, remoteJid, user);
      return;
    }

    if (matches(["rekomendasi", "ai", "saran"], "3")) {
      await sock.sendMessage(remoteJid, {
        text:
          `🤖 *REKOMENDASI RESTOCK AI*\n\n` +
          `Sistem AI menganalisis pola konsumsi harian usaha Anda untuk memprediksi kebutuhan bahan baku.\n\n` +
          `Lihat rekomendasi lengkap & langsung pesan di Dashboard:\n` +
          `👉 ${FRONTEND_URL}/dashboard/procurement`,
      });
      return;
    }

    if (matches(["bantuan", "admin", "help", "cs"], "4")) {
      await sendHelpMessage(sock, remoteJid, role);
      return;
    }
  }

  // C. AI NLP PARSING UNTUK TEKS ALAMI (khusus Petani)
  if (role === "PETANI") {
    const aiResult = await parseFarmerMessageWithAI(cleanBody);

    if (aiResult.isHarvestInput && aiResult.commodityName && aiResult.quantityKg) {
      if (!user) {
        await sock.sendMessage(remoteJid, {
          text: `⚠️ Akun Anda belum lengkap. Mohon selesaikan aktivasi lokasi:\n👉 ${buildShareLocationLink(senderLid)}`,
        });
        return;
      }

      let pricePerKg = aiResult.pricePerKg ?? 0;
      if (!pricePerKg && user.regionName) {
        // Cari harga dari database atau scrape AI
        const ref = await prisma.priceHistory.findFirst({
          where: { regionName: user.regionName, commodity: aiResult.commodityName },
        });
        pricePerKg = ref?.farmer_price ?? 0;

        // Jika belum ada di database, scrape dengan AI
        if (!pricePerKg) {
          const scraped = await scrapePriceAI(aiResult.commodityName, user.regionName);
          pricePerKg = scraped?.farmerPrice ?? 25000;
        }
      }
      if (!pricePerKg) pricePerKg = 25000;

      // Simpan draft dengan info lokasi dari user
      await prisma.waRegistration.update({
        where: { waLid: senderLid },
        data: {
          pendingDraft: JSON.stringify({
            commodityName: aiResult.commodityName,
            quantityKg: aiResult.quantityKg,
            pricePerKg,
            harvestDate: aiResult.harvestDate,
            deliveryReadyDate: aiResult.deliveryReadyDate,
            scheduleLabel: aiResult.scheduleLabel,
            latitude: user.latitude,
            longitude: user.longitude,
            regionName: user.regionName,
          }),
        },
      });

      await sock.sendMessage(remoteJid, {
        text:
          `🤖 *AI MENDETEKSI INPUT PANEN ANDA*\n\n` +
          `• *Komoditas:* ${aiResult.commodityName}\n` +
          `• *Kuantitas:* ${aiResult.quantityKg} Kg\n` +
          `• *Harga:* ${rupiah(pricePerKg)} / Kg\n` +
          `• *Lokasi:* ${user.regionName ?? "-"}\n` +
          `• *Jadwal Panen:* ${aiResult.harvestDate ? wibDate(aiResult.harvestDate) : "Hari ini"}${aiResult.scheduleLabel ? ` (${aiResult.scheduleLabel})` : ""}\n` +
          `• *Ready Diantar/Diambil:* ${aiResult.deliveryReadyDate ? wibDateTime(aiResult.deliveryReadyDate) : "-"}\n\n` +
          `Ketik *YA* untuk langsung memasukkan ke Radar PetaniKita, atau *BATAL* untuk membatalkan.\n\n` +
          `_💡 Ketik *0* untuk kembali ke menu utama._`,
      });
      console.log(`   🤖 AI parse [${aiResult.confidence}]: ${aiResult.commodityName} ${aiResult.quantityKg}kg @${pricePerKg}`);
      return;
    }
  }

  // D. FALLBACK -> tampilkan menu sesuai peran
  await sock.sendMessage(remoteJid, {
    text:
      `🌾 *PetaniKita Bot*\n\n` +
      `Maaf, saya belum menangkap maksud pesan Anda.\n\n` +
      buildPostActivationMenu(role, userName),
  });
}

export async function handleIncomingWaMessages(
  sock: WASocket,
  m: { messages: proto.IWebMessageInfo[]; type: string }
) {
  try {
    if (m.type !== "notify") return;

    for (const msg of m.messages) {
      if (!msg?.key) continue;
      if (msg.key.fromMe || msg.key.remoteJid === "status@broadcast") continue;

      const remoteJid = msg.key.remoteJid || "";
      const senderLid = msg.key.participant || remoteJid;

      const bodyText =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.buttonsResponseMessage?.selectedButtonId ||
        "";

      const cleanBody = bodyText.trim();
      if (!remoteJid || !cleanBody) continue;

      console.log(`\n📩 [CHAT MASUK WA]`);
      console.log(`   ├─ From JID/LID : ${senderLid}`);
      console.log(`   ├─ Pesan        : "${cleanBody}"`);
      console.log(`   └─ Waktu        : ${new Date().toLocaleTimeString("id-ID")}`);

      const waReg = await prisma.waRegistration.upsert({
        where: { waLid: senderLid },
        update: { waJid: remoteJid },
        create: {
          waLid: senderLid,
          waJid: remoteJid,
          step: "START",
          isRegistered: false,
        },
      });

      if (waReg.isRegistered || waReg.step === "COMPLETED") {
        await handleActiveUserMessage(sock, remoteJid, senderLid, waReg, cleanBody);
        continue;
      }

      // Handle "DAFTAR [registrationCode]" atau langsung "PKxxxxxx"
      const tokenMatch = cleanBody.match(/(?:DAFTAR|REGISTER|Daftar|Register)?\s*(PK\d{6,})/i);
      const hanyaKode = cleanBody.match(/^(PK\d{6,})$/i);
      const hanyaDaftar = /^(DAFTAR|REGISTER|Daftar|Register)$/i.test(cleanBody);

      // Jika user kirim "DAFTAR" tanpa kode
      if (hanyaDaftar) {
        await sock.sendMessage(remoteJid, {
          text:
            `📝 *Format Registrasi WhatsApp*\n\n` +
            `Silakan kirim format berikut:\n` +
            `*DAFTAR [KodeRegistrasiAnda]*\n\n` +
            `Contoh: *DAFTAR PK123456*\n\n` +
            `💡 *Belum punya kode?*\n` +
            `Daftar terlebih dahulu di website:\n` +
            `👉 ${process.env.FRONTEND_URL || "https://xc4v9xjv-3000.asse.devtunnels.ms"}/auth/register`,
        });
        continue;
      }

      // Jika user kirim kode registrasi (dengan atau tanpa prefix DAFTAR)
      if (tokenMatch || hanyaKode) {
        const regCode = (tokenMatch ? tokenMatch[1] : hanyaKode![1]).toUpperCase();

        // Cari user berdasarkan registrationCode
        const user = await prisma.user.findUnique({ where: { registrationCode: regCode } });

        if (!user) {
          await sock.sendMessage(remoteJid, {
            text:
              `⚠️ *Kode Registrasi Tidak Valid!*\n\n` +
              `Kode "${regCode}" tidak ditemukan di sistem.\n\n` +
              `Silakan daftar terlebih dahulu di website PetaniKita:\n` +
              `👉 ${process.env.FRONTEND_URL || "https://xc4v9xjv-3000.asse.devtunnels.ms"}/auth/register`,
          });
          continue;
        }

        // Cek apakah LID ini sudah terhubung dengan akun lain
        const existingUserWithLid = await prisma.user.findUnique({ where: { waLid: senderLid } });
        if (existingUserWithLid && existingUserWithLid.id !== user.id) {
          await sock.sendMessage(remoteJid, {
            text:
              `⚠️ *WhatsApp Sudah Terhubung!*\n\n` +
              `Akun WhatsApp ini sudah terhubung dengan akun lain (${existingUserWithLid.name}).\n` +
              `Silakan gunakan nomor lain atau hubungi admin.`,
          });
          continue;
        }

        // Link WhatsApp ke akun user (simpan LID terpisah, phone_number tetap dari registrasi)
        await prisma.user.update({
          where: { id: user.id },
          data: { waLid: senderLid },
        });

        // Update waRegistration sebagai completed
        await prisma.waRegistration.upsert({
          where: { waLid: senderLid },
          update: {
            step: "COMPLETED",
            isRegistered: true,
            phone: user.phone_number,
            name: user.name,
            role: user.role,
          },
          create: {
            waLid: senderLid,
            waJid: remoteJid,
            step: "COMPLETED",
            isRegistered: true,
            phone: user.phone_number,
            name: user.name,
            role: user.role,
          },
        });

        await sock.sendMessage(remoteJid, {
          text:
            `✅ *WhatsApp Berhasil Terhubung!*\n\n` +
            `Halo *${user.name}*!\n` +
            `Akun Anda berhasil terhubung dengan WhatsApp.\n\n` +
            `Nomor terdaftar: *${user.phone_number}*\n` +
            `Sekarang Anda akan menerima notifikasi pesanan langsung di WhatsApp ini.\n\n` +
            `Ketik *MENU* untuk melihat menu yang tersedia.`,
        });

        console.log(`[WA BOT] ✓ User "${user.username}" (${regCode}) berhasil link WA: ${user.phone_number}`);
        continue;
      }

      switch (waReg.step) {
        case "START": {
          if (cleanBody === "1") {
            // Daftar akun baru
            await prisma.waRegistration.update({
              where: { waLid: senderLid },
              data: { step: "AWAITING_ROLE" },
            });
            await sock.sendMessage(remoteJid, { text: buildRoleMenuMessage() });
            console.log(`   📤 Menu pilihan role dikirim ke ${senderLid}.`);
          } else if (cleanBody === "2") {
            // Login ke akun existing
            await prisma.waRegistration.update({
              where: { waLid: senderLid },
              data: { step: "AWAITING_LOGIN_IDENTIFIER" },
            });
            await sock.sendMessage(remoteJid, {
              text:
                `🔐 *LOGIN KE AKUN PETANIKITA*\n\n` +
                `Silakan masukkan *Username*, *Nama*, atau *No. WhatsApp* terdaftar Anda:\n\n` +
                `_Contoh: budisantoso88 atau 081229411387_`,
            });
            console.log(`   📤 Menu login dikirim ke ${senderLid}.`);
          } else if (cleanBody === "3") {
            await sock.sendMessage(remoteJid, {
              text:
                `ℹ️ *BANTUAN PETANIKITA*\n\n` +
                `PetaniKita menghubungkan Petani, UMKM Kuliner, dan Tengkulak dalam satu ekosistem pangan lokal.\n\n` +
                `• Petani: jual hasil panen langsung ke UMKM\n` +
                `• UMKM: beli bahan baku segar harga wajar\n` +
                `• Tengkulak: ambil tugas logistik & angkut\n\n` +
                `_Ketik angka 1 untuk mendaftar atau 2 untuk login._`,
            });
          } else {
            await sock.sendMessage(remoteJid, { text: buildWelcomeMessage(senderLid) });
            console.log(`   📤 Menu utama dikirim ke ${senderLid}.`);
          }
          break;
        }

        // ========== LOGIN FLOW ==========
        case "AWAITING_LOGIN_IDENTIFIER": {
          const loginIdentifier = cleanBody.trim();

          // Cari user di database berdasarkan username, name, atau phone_number
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { username: loginIdentifier },
                { name: loginIdentifier },
                { phone_number: sanitizePhoneTo62(loginIdentifier) },
              ],
            },
          });

          if (!user) {
            await sock.sendMessage(remoteJid, {
              text:
                `⚠️ *Akun tidak ditemukan.*\n\n` +
                `Pastikan Anda memasukkan username, nama, atau no. HP yang terdaftar.\n\n` +
                `Ketik *1* untuk mendaftar akun baru, atau coba lagi dengan identifier lain.`,
            });
            return;
          }

          // Simpan identifier sementara dan minta password
          await prisma.waRegistration.update({
            where: { waLid: senderLid },
            data: {
              step: "AWAITING_LOGIN_PASSWORD",
              pendingDraft: JSON.stringify({ userId: user.id, identifier: loginIdentifier }),
            },
          });

          await sock.sendMessage(remoteJid, {
            text:
              `✅ *Akun ditemukan!*\n\n` +
              `• Nama: *${user.name}*\n` +
              `• Peran: *${user.role}*\n\n` +
              `🔐 Silakan masukkan *Password* Anda:`,
          });
          console.log(`   🔐 Login: akun "${user.name}" (${user.role}) ditemukan, menunggu password.`);
          break;
        }

        case "AWAITING_LOGIN_PASSWORD": {
          const draft = waReg.pendingDraft ? JSON.parse(waReg.pendingDraft) : null;
          if (!draft) {
            await prisma.waRegistration.update({
              where: { waLid: senderLid },
              data: { step: "START" },
            });
            await sock.sendMessage(remoteJid, { text: buildWelcomeMessage(senderLid) });
            return;
          }

          const user = await prisma.user.findUnique({ where: { id: draft.userId } });
          if (!user) {
            await sock.sendMessage(remoteJid, {
              text: `⚠️ *Akun tidak ditemukan.* Silakan ulangi dari awal.`,
            });
            await prisma.waRegistration.update({
              where: { waLid: senderLid },
              data: { step: "START" },
            });
            return;
          }

          // Verifikasi password
          const bcrypt = await import("bcrypt");
          const isValidPassword = user.password
            ? await bcrypt.compare(cleanBody, user.password)
            : cleanBody === user.phone_number; // Fallback: jika belum set password, gunakan no HP

          if (!isValidPassword) {
            await sock.sendMessage(remoteJid, {
              text:
                `❌ *Password salah.*\n\n` +
                `Silakan masukkan password yang benar, atau ketik *BATAL* untuk kembali ke menu utama.`,
            });
            return;
          }

          // Login berhasil! Update waRegistration dan link ke user
          await prisma.waRegistration.update({
            where: { waLid: senderLid },
            data: {
              step: "COMPLETED",
              isRegistered: true,
              phone: user.phone_number,
              name: user.name,
              role: user.role,
              pendingDraft: null,
            },
          });

          // Log aktivitas login
          logActivity({
            userId: String(user.id),
            role: user.role,
            actorPhone: user.phone_number,
            actorName: user.name,
            action: "USER_LOGIN",
            module: "AUTH",
            description: `User "${user.name}" (${user.role}) berhasil login via Bot WhatsApp.`,
            userAgent: `WhatsApp Bot (LID: ${senderLid})`,
          });

          await sock.sendMessage(remoteJid, {
            text:
              `🎉 *LOGIN BERHASIL!*\n\n` +
              `Selamat datang kembali, *${user.name}*!\n` +
              `Peran: *${user.role}*\n\n` +
              buildPostActivationMenu(user.role, user.name),
          });
          console.log(`   ✅ Login berhasil: ${user.name} (${user.role}) via WA.`);
          break;
        }

        case "AWAITING_ROLE": {
          const selectedRole = ROLE_BY_INPUT[cleanBody];

          if (!selectedRole) {
            await sock.sendMessage(remoteJid, {
              text: `⚠️ *Pilihan tidak valid.*\nMohon balas dengan angka *1* (Petani) atau *2* (UMKM).`,
            });
            console.log(`   ⚠️ Role invalid ("${cleanBody}") dari ${senderLid}.`);
            break;
          }

          await prisma.waRegistration.update({
            where: { waLid: senderLid },
            data: { role: selectedRole, step: "AWAITING_NAME" },
          });

          await sock.sendMessage(remoteJid, {
            text: `✅ Peran dipilih: *${selectedRole}*\n\nSilakan ketik *Nama Lengkap* Anda:`,
          });
          console.log(`   ✅ Role ${selectedRole} dipilih oleh ${senderLid}.`);
          break;
        }

        case "AWAITING_NAME": {
          if (cleanBody.length < 3) {
            await sock.sendMessage(remoteJid, {
              text: `⚠️ Nama terlalu pendek. Silakan masukkan *Nama Lengkap* Anda:`,
            });
            break;
          }

          await prisma.waRegistration.update({
            where: { waLid: senderLid },
            data: { name: cleanBody, step: "AWAITING_PHONE" },
          });

          await sock.sendMessage(remoteJid, {
            text:
              `Terima kasih Pak/Bu *${cleanBody}*.\n\n` +
              `Langkah Terakhir: Masukkan *Nomor WhatsApp* aktif Anda (Contoh: 081229411387):`,
          });
          console.log(`   ✅ Nama "${cleanBody}" tersimpan untuk ${senderLid}.`);
          break;
        }

        case "AWAITING_PHONE": {
          const sanitizedPhone = sanitizePhoneTo62(cleanBody);

          if (sanitizedPhone.length < 10) {
            await sock.sendMessage(remoteJid, {
              text: `⚠️ Format nomor HP tidak valid. Masukkan nomor WhatsApp yang benar (Contoh: 081229411387):`,
            });
            console.log(`   ⚠️ Nomor HP invalid ("${cleanBody}") dari ${senderLid}.`);
            break;
          }

          await prisma.waRegistration.update({
            where: { waLid: senderLid },
            data: { phone: sanitizedPhone, step: "COMPLETED", isRegistered: true },
          });

          logActivity({
            actorPhone: sanitizedPhone,
            actorName: waReg.name ?? "Mitra WA",
            role: waReg.role ?? "PETANI",
            action: "USER_REGISTERED_WA",
            module: "AUTH",
            description: `Pendaftaran via Bot WhatsApp selesai — "${waReg.name}" terdaftar sebagai ${waReg.role} dengan nomor ${sanitizedPhone}. Menunggu aktivasi lokasi GPS & password.`,
            userAgent: `WhatsApp Bot (LID: ${senderLid})`,
          });

          await sock.sendMessage(remoteJid, {
            text:
              `🎉 *PENDAFTARAN AWAL BERHASIL!*\n\n` +
              `• Nama: *${waReg.name}*\n` +
              `• Peran: *${waReg.role}*\n` +
              `• No HP: *${sanitizedPhone}*\n\n` +
              `📌 *SATU LANGKAH TERAKHIR:*\n` +
              `Klik link di bawah ini untuk *mengirimkan lokasi terkini* dan *membuat password login Web*:\n\n` +
              `👉 ${buildShareLocationLink(senderLid)}`,
          });
          console.log(`   ✅ ${senderLid} selesai daftar (${waReg.name} - ${waReg.role}) - link lokasi dikirim.`);
          break;
        }

        default: {
          await prisma.waRegistration.update({
            where: { waLid: senderLid },
            data: { step: "START" },
          });
          await sock.sendMessage(remoteJid, { text: buildWelcomeMessage(senderLid) });
          break;
        }
      }
    }
  } catch (error) {
    console.error("❌ Error handling incoming WA message:", error);
  }
}
