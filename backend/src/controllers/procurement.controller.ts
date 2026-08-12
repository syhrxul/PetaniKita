import { prisma } from "../lib/prisma.js";
import { calculateFairDeliveryFee, type DeliveryMethod } from "../utils/freightCalculator.js";
import { sanitizePhoneTo62, formatToWaJid } from "../utils/phoneSanitizer.js";
import { getSocket } from "../services/whatsapp.service.js";
import { sendHumanLikeWaMessage } from "../services/whatsappBot.service.js";
import { logActivity } from "../services/auditLog.service.js";

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

/**
 * Kirim notifikasi WA dengan delay dan animasi typing.
 * Menghindari deteksi spam dan blokir dari WhatsApp.
 */
async function sendNotificationWithDelay(
  sock: any,
  phoneNumber: string,
  message: string,
  delayMs: number = 2000
): Promise<boolean> {
  try {
    // Delay sebelum kirim (anti-spam)
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Kirim dengan animasi typing (sudah include di sendHumanLikeWaMessage)
    const success = await sendHumanLikeWaMessage(sock, phoneNumber, message);

    if (success) {
      console.log(`[NOTIF] ✓ Terkirim ke ${phoneNumber} (delay ${delayMs}ms)`);
    } else {
      console.warn(`[NOTIF] ✗ Gagal kirim ke ${phoneNumber}`);
    }

    return success;
  } catch (err) {
    console.error(`[NOTIF] ✗ Error kirim ke ${phoneNumber}:`, err);
    return false;
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371.0;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

/**
 * Tolak order + kembalikan stok panen secara ATOMIC.
 * Dipakai bersama oleh Web Dashboard Petani & Bot WhatsApp.
 */
export async function rejectOrderWithReason(orderId: number, rejectionReason: string) {
  const order = await prisma.umkmOrder.findUnique({ where: { id: orderId } });

  if (!order) throw new Error("Order tidak ditemukan.");
  if (order.status === "REJECTED" || order.status === "COMPLETED") {
    throw new Error("Order sudah tidak dapat diubah lagi.");
  }

  const reason = rejectionReason?.trim() || "Stok tidak mencukupi atau kendala cuaca di ladang.";

  const [updatedOrder] = await prisma.$transaction([
    prisma.umkmOrder.update({
      where: { id: orderId },
      data: { status: "REJECTED", rejection_reason: reason },
    }),
    ...(order.harvest_event_id
      ? [
          prisma.harvestEvent.update({
            where: { id: order.harvest_event_id },
            data: { est_yield_kg: { increment: order.amount_kg } },
          }),
        ]
      : []),
  ]);

  return { updatedOrder, restoredKg: order.amount_kg, reason };
}

/**
 * Checkout Direct P2P (Petani <-> UMKM), mendukung Nego Harga & 2 opsi pengiriman.
 */
export async function createP2POrder(req: any, res: any) {
  try {
    const {
      harvestEventId,
      quantityKg,
      proposedPricePerKg,
      negoReason,
      deliveryMethod,
      umkmUserId,
    } = req.body;

    const eventId = Number(harvestEventId);
    const kg = Number(quantityKg);
    const umkmId = Number(umkmUserId);
    const method: DeliveryMethod =
      deliveryMethod === "COD_AMBIL_SENDIRI" ? "COD_AMBIL_SENDIRI" : "DIANTAR_PETANI";

    if (!eventId || !Number.isFinite(kg) || kg <= 0) {
      return res.status(400).json({ success: false, message: "Data pesanan tidak valid." });
    }
    if (!umkmId || Number.isNaN(umkmId)) {
      return res.status(400).json({ success: false, message: "ID UMKM tidak valid." });
    }

    const umkmUser = await prisma.user.findUnique({ where: { id: umkmId } });
    if (!umkmUser) {
      return res.status(404).json({ success: false, message: "User UMKM tidak ditemukan." });
    }

    const harvest = await prisma.harvestEvent.findUnique({
      where: { id: eventId },
      include: { crop: { include: { user: true } } },
    });

    if (!harvest) {
      return res.status(404).json({ success: false, message: "Panen tidak ditemukan." });
    }
    if (harvest.est_yield_kg < kg) {
      return res.status(400).json({
        success: false,
        message: `Stok panen tidak mencukupi. Tersisa ${harvest.est_yield_kg} Kg.`,
      });
    }

    const farmer = harvest.crop.user;
    const commodity = harvest.crop.crop_type;

    // Harga asli petani: dari harvest, fallback ke price_histories, fallback default
    let originalPrice = harvest.price_per_kg ?? 0;
    if (!originalPrice) {
      const ref = await prisma.priceHistory.findFirst({
        where: { commodity, ...(harvest.crop.regionName ? { regionName: harvest.crop.regionName } : {}) },
        orderBy: { updated_at: "desc" },
      });
      originalPrice = ref?.farmer_price ?? 25000;
    }

    const proposed = Number(proposedPricePerKg);
    const isNego = Number.isFinite(proposed) && proposed > 0 && proposed !== originalPrice;
    const finalPricePerKg = isNego ? proposed : originalPrice;

    // Jarak geospasial Petani -> UMKM
    const distanceKm = haversineKm(
      harvest.crop.latitude,
      harvest.crop.longitude,
      umkmUser.latitude ?? -7.7558,
      umkmUser.longitude ?? 110.4052,
    );

    const deliveryFee = calculateFairDeliveryFee(distanceKm, kg, method);
    const foodTotalPrice = kg * finalPricePerKg;
    const grandTotal = foodTotalPrice + deliveryFee;

    const initialStatus = isNego ? "WAITING_FARMER_NEGO_APPROVAL" : "PENDING_FARMER_CONFIRMATION";

    const order = await prisma.$transaction(async tx => {
      const created = await tx.umkmOrder.create({
        data: {
          umkm_user_id: umkmId,
          harvest_event_id: eventId,
          amount_kg: kg,
          price_per_kg: finalPricePerKg,
          original_price_per_kg: originalPrice,
          is_nego: isNego,
          nego_reason: negoReason || null,
          delivery_method: method,
          distance_km: distanceKm,
          delivery_fee: deliveryFee,
          food_total_price: foodTotalPrice,
          grand_total: grandTotal,
          total_amount: grandTotal,
          payment_method: method === "COD_AMBIL_SENDIRI" ? "COD" : "TRANSFER",
          is_self_pickup: method === "COD_AMBIL_SENDIRI",
          status: initialStatus,
        },
      });

      // Kunci stok sementara agar tidak dipesan ganda
      await tx.harvestEvent.update({
        where: { id: eventId },
        data: { est_yield_kg: { decrement: kg } },
      });

      return created;
    });

    // NOTIFIKASI WA KE PETANI UNTUK KONFIRMASI / PERSETUJUAN NEGO
    const sock = getSocket();
    const farmerPhoneSanitized = sanitizePhoneTo62(farmer.phone_number);
    if (sock && farmer.phone_number) {
      const methodLabel =
        method === "DIANTAR_PETANI"
          ? `Diantar oleh Anda (Ongkir ${rupiah(deliveryFee)})`
          : `Ambil Sendiri ke Ladang (COD)`;

      const negoBlock = isNego
        ? `\n⚠️ *PENGAJUAN NEGO HARGA:*\n` +
          `• Harga Asli Anda: ${rupiah(originalPrice)}/Kg\n` +
          `• Ditawar Jadi: *${rupiah(finalPricePerKg)}*/Kg\n` +
          `• Alasan UMKM: "${negoReason || "-"}"\n`
        : "";

      const waMsg =
        `🌾 *PESANAN BARU MASUK (PETANIKITA)* 🌾\n\n` +
        `Halo Pak/Bu *${farmer.name}*,\n` +
        `UMKM *${umkmUser.name}* memesan hasil panen Anda (*${commodity}*)!\n\n` +
        `📦 *Detail Pesanan #${order.id}:*\n` +
        `• Kuantitas: *${kg} Kg*\n` +
        `• Harga: *${rupiah(finalPricePerKg)}*/Kg\n` +
        `• Metode: *${methodLabel}*\n` +
        `• Jarak: ${distanceKm} km\n` +
        `• Total Bahan: *${rupiah(foodTotalPrice)}*\n` +
        `• Total Diterima: *${rupiah(grandTotal)}*\n` +
        negoBlock +
        `\n📲 Kontak Pembeli: https://wa.me/${sanitizePhoneTo62(umkmUser.phone_number)}\n\n` +
        `📌 *MOHON KONFIRMASI:*\n` +
        `Balas pesan ini dengan:\n` +
        `👉 *ACC* (Untuk Menerima Pesanan)\n` +
        `👉 *TOLAK#Alasan* (Contoh: TOLAK#Stok di ladang rusak karena hujan)`;

      // Kirim notifikasi dengan delay anti-spam (2 detik)
      sendNotificationWithDelay(sock, farmer.phone_number, waMsg, 2000).catch(err =>
        console.error("[WA BOT] Gagal notif petani:", err)
      );
    }

    logActivity({
      userId: umkmId,
      role: "UMKM",
      actorPhone: umkmUser.phone_number,
      actorName: umkmUser.name,
      action: isNego ? "NEGO_SUBMITTED" : "CHECKOUT_ORDER",
      module: "ORDER",
      description: isNego
        ? `UMKM "${umkmUser.name}" mengajukan NEGO pada order #${order.id}: ${commodity} ${kg} Kg, harga ${rupiah(originalPrice)} → ${rupiah(finalPricePerKg)}/Kg ke Petani "${farmer.name}" (jarak ${distanceKm} km). Alasan: ${negoReason || "-"}.`
        : `UMKM "${umkmUser.name}" checkout order #${order.id}: ${commodity} ${kg} Kg @ ${rupiah(finalPricePerKg)}/Kg dari Petani "${farmer.name}" (jarak ${distanceKm} km, ongkir ${rupiah(deliveryFee)}, total ${rupiah(grandTotal)}).`,
      ipAddress: req.ip,
      userAgent: req.headers?.["user-agent"],
    });

    return res.status(200).json({
      success: true,
      message: isNego
        ? "Pengajuan nego terkirim. Menunggu persetujuan Petani."
        : "Pesanan berhasil dibuat. Menunggu konfirmasi Petani.",
      data: {
        order,
        farmerName: farmer.name,
        farmerPhone: farmerPhoneSanitized,
        farmerWaUrl: `https://wa.me/${farmerPhoneSanitized}`,
        breakdown: {
          pricePerKg: finalPricePerKg,
          originalPricePerKg: originalPrice,
          isNego,
          quantityKg: kg,
          distanceKm,
          deliveryFee,
          foodTotalPrice,
          grandTotal,
        },
      },
    });
  } catch (error) {
    console.error("P2P Order Error:", error);
    return res.status(500).json({ success: false, message: "Gagal memproses pesanan." });
  }
}

/**
 * Estimasi ongkir & total sebelum checkout (untuk preview transparan di UI)
 */
export async function quoteP2POrder(req: any, res: any) {
  try {
    const { harvestEventId, quantityKg, umkmUserId, deliveryMethod, proposedPricePerKg } = req.body;
    const eventId = Number(harvestEventId);
    const kg = Number(quantityKg);
    const method: DeliveryMethod =
      deliveryMethod === "COD_AMBIL_SENDIRI" ? "COD_AMBIL_SENDIRI" : "DIANTAR_PETANI";

    const harvest = await prisma.harvestEvent.findUnique({
      where: { id: eventId },
      include: { crop: { include: { user: true } } },
    });
    const umkmUser = await prisma.user.findUnique({ where: { id: Number(umkmUserId) } });

    if (!harvest || !umkmUser) {
      return res.status(404).json({ success: false, message: "Data panen / UMKM tidak ditemukan." });
    }

    let originalPrice = harvest.price_per_kg ?? 0;
    if (!originalPrice) {
      const ref = await prisma.priceHistory.findFirst({
        where: { commodity: harvest.crop.crop_type },
        orderBy: { updated_at: "desc" },
      });
      originalPrice = ref?.farmer_price ?? 25000;
    }

    const proposed = Number(proposedPricePerKg);
    const isNego = Number.isFinite(proposed) && proposed > 0 && proposed !== originalPrice;
    const pricePerKg = isNego ? proposed : originalPrice;

    const distanceKm = haversineKm(
      harvest.crop.latitude,
      harvest.crop.longitude,
      umkmUser.latitude ?? -7.7558,
      umkmUser.longitude ?? 110.4052,
    );
    const deliveryFee = calculateFairDeliveryFee(distanceKm, kg, method);
    const foodTotalPrice = kg * pricePerKg;

    return res.json({
      success: true,
      data: {
        commodity: harvest.crop.crop_type,
        farmerName: harvest.crop.user.name,
        farmerPhone: sanitizePhoneTo62(harvest.crop.user.phone_number),
        availableKg: harvest.est_yield_kg,
        originalPricePerKg: originalPrice,
        pricePerKg,
        isNego,
        quantityKg: kg,
        distanceKm,
        deliveryMethod: method,
        deliveryFee,
        foodTotalPrice,
        grandTotal: foodTotalPrice + deliveryFee,
      },
    });
  } catch (error) {
    console.error("Quote P2P Error:", error);
    return res.status(500).json({ success: false, message: "Gagal menghitung estimasi." });
  }
}

/**
 * Petani menyetujui / menolak pesanan lewat Web (mirror dari alur WA)
 */
export async function respondToOrderByFarmer(req: any, res: any) {
  try {
    const orderId = Number(req.params.id);
    const { action, rejectionReason } = req.body;

    const order = await prisma.umkmOrder.findUnique({
      where: { id: orderId },
      include: {
        umkm_user: true,
        harvest_event: { include: { crop: { include: { user: true } } } },
      },
    });

    if (!order) return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });

    if (order.status !== "PENDING_FARMER_CONFIRMATION" && order.status !== "WAITING_FARMER_NEGO_APPROVAL") {
      return res.status(409).json({
        success: false,
        message: `Pesanan sudah berstatus ${order.status} dan tidak bisa diubah.`,
      });
    }

    const farmer = order.harvest_event?.crop?.user;
    const commodity = order.harvest_event?.crop?.crop_type ?? "Komoditas";
    const sock = getSocket();

    if (String(action).toUpperCase() === "ACCEPT") {
      const updated = await prisma.umkmOrder.update({
        where: { id: orderId },
        data: { status: "ACCEPTED" },
      });

      if (sock && order.umkm_user?.phone_number && farmer) {
        const msg =
          `🎉 *PESANAN ANDA DISETUJUI PETANI!* 🎉\n\n` +
          `Petani *${farmer.name}* menyetujui pesanan *${commodity}* (${order.amount_kg} Kg).\n` +
          `• Harga: ${rupiah(order.price_per_kg ?? 0)}/Kg\n` +
          `• Total: ${rupiah(order.grand_total ?? order.total_amount)}\n` +
          `• Metode: ${order.delivery_method === "COD_AMBIL_SENDIRI" ? "Ambil Sendiri (COD)" : "Diantar Petani"}\n\n` +
          `📲 Hubungi Petani: https://wa.me/${sanitizePhoneTo62(farmer.phone_number)}`;
        // Kirim notifikasi dengan delay anti-spam (3 detik)
        sendNotificationWithDelay(sock, order.umkm_user.phone_number, msg, 3000).catch(() => {});
      }

      logActivity({
        userId: farmer?.id,
        role: "PETANI",
        actorPhone: farmer?.phone_number,
        actorName: farmer?.name ?? "Petani",
        action: "ORDER_ACCEPTED",
        module: "ORDER",
        description: `Petani "${farmer?.name ?? "-"}" MENYETUJUI order #${orderId} (${commodity}, ${order.amount_kg} Kg, ${rupiah(order.grand_total ?? order.total_amount)}) dari UMKM "${order.umkm_user?.name ?? "-"}" via Web.`,
        ipAddress: req.ip,
        userAgent: req.headers?.["user-agent"],
      });

      return res.json({ success: true, message: "Pesanan disetujui.", data: updated });
    }

    // REJECT — atomic: ubah status + kembalikan stok
    const { updatedOrder: updated, restoredKg, reason } = await rejectOrderWithReason(
      orderId,
      rejectionReason
    );

    if (sock && order.umkm_user?.phone_number && farmer) {
      const msg =
        `❌ *PESANAN DITOLAK OLEH PETANI*\n\n` +
        `Mohon maaf, pesanan *${commodity}* Anda ditolak oleh Pak/Bu *${farmer.name}*.\n\n` +
        `💬 *Alasan Penolakan:*\n"${reason}"\n\n` +
        `Stok *${restoredKg} Kg* telah dikembalikan. Silakan pilih petani terdekat lainnya di Web PetaniKita.`;
      // Kirim notifikasi dengan delay anti-spam (3 detik)
      sendNotificationWithDelay(sock, order.umkm_user.phone_number, msg, 3000).catch(() => {});
    }

    logActivity({
      userId: farmer?.id,
      role: "PETANI",
      actorPhone: farmer?.phone_number,
      actorName: farmer?.name ?? "Petani",
      action: "ORDER_REJECTED",
      module: "ORDER",
      description: `Petani "${farmer?.name ?? "-"}" MENOLAK order #${orderId} (${commodity}, ${restoredKg} Kg) dari UMKM "${order.umkm_user?.name ?? "-"}". Alasan: "${reason}". Stok dikembalikan ke radar.`,
      ipAddress: req.ip,
      userAgent: req.headers?.["user-agent"],
    });

    return res.json({
      success: true,
      message: `Pesanan ditolak & stok ${restoredKg} Kg dikembalikan.`,
      data: updated,
    });
  } catch (error) {
    console.error("Farmer respond error:", error);
    return res.status(500).json({ success: false, message: "Gagal memproses respon petani." });
  }
}
