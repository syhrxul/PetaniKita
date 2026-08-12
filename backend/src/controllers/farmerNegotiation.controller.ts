import { prisma } from "../lib/prisma.js";
import { sanitizePhoneTo62, formatToWaJid } from "../utils/phoneSanitizer.js";
import { getSocket } from "../services/whatsapp.service.js";
import { sendHumanLikeWaMessage } from "../services/whatsappBot.service.js";

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

    // Kirim dengan animasi typing
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
import { rejectOrderWithReason } from "./procurement.controller.js";
import { logActivity } from "../services/auditLog.service.js";

const rupiah = (n: number) => `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;

/** Sumber penawaran: order UMKM terdaftar, atau nego publik dari marketplace */
export type NegoSource = "UMKM_ORDER" | "PUBLIC_OFFER";

export interface UnifiedNegotiation {
  id: string;
  source: NegoSource;
  rawId: number;
  isNego: boolean;
  status: string;
  commodityName: string;
  quantityKg: number;
  pricePerKg: number;
  originalPricePerKg: number;
  negoReason: string | null;
  rejectionReason: string | null;
  buyerName: string;
  buyerPhone: string;
  buyerRegion: string | null;
  buyerWaUrl: string;
  deliveryMethod: string | null;
  deliveryFee: number | null;
  grandTotal: number;
  createdAt: Date;
}

/**
 * GET /api/v1/farmer/negotiations
 * Gabungkan penawaran dari 2 kanal: UmkmOrder (Web UMKM & WA Bot) + PriceNegotiation (marketplace publik)
 */
export async function getFarmerNegotiations(req: any, res: any) {
  try {
    const farmerId = Number(req.query.farmerId ?? req.user?.id ?? 1);
    if (!farmerId || Number.isNaN(farmerId)) {
      return res.status(400).json({ success: false, message: "farmerId tidak valid." });
    }

    // Panen milik petani ini
    const crops = await prisma.farmCrop.findMany({
      where: { user_id: farmerId },
      select: { id: true },
    });
    const cropIds = crops.map(c => c.id);

    const harvests = await prisma.harvestEvent.findMany({
      where: { crop_id: { in: cropIds } },
      select: { id: true, crop: { select: { crop_type: true } } },
    });
    const harvestIds = harvests.map(h => h.id);

    // Kanal 1: Order UMKM terdaftar
    const orders = await prisma.umkmOrder.findMany({
      where: { harvest_event_id: { in: harvestIds } },
      include: {
        umkm_user: { select: { name: true, phone_number: true, regionName: true } },
        harvest_event: { include: { crop: { select: { crop_type: true } } } },
      },
      orderBy: { created_at: "desc" },
    });

    // Kanal 2: Nego publik dari marketplace (pembeli tanpa akun)
    const publicOffers = await prisma.priceNegotiation.findMany({
      where: { harvest_event_id: { in: harvestIds } },
      orderBy: { created_at: "desc" },
    });

    const fromOrders: UnifiedNegotiation[] = orders.map(o => ({
      id: `ORDER-${o.id}`,
      source: "UMKM_ORDER",
      rawId: o.id,
      isNego: o.is_nego,
      status: o.status,
      commodityName: o.harvest_event?.crop?.crop_type ?? "Komoditas",
      quantityKg: o.amount_kg,
      pricePerKg: o.price_per_kg ?? 0,
      originalPricePerKg: o.original_price_per_kg ?? o.price_per_kg ?? 0,
      negoReason: o.nego_reason,
      rejectionReason: o.rejection_reason,
      buyerName: o.umkm_user?.name ?? "UMKM",
      buyerPhone: sanitizePhoneTo62(o.umkm_user?.phone_number ?? ""),
      buyerRegion: o.umkm_user?.regionName ?? null,
      buyerWaUrl: `https://wa.me/${sanitizePhoneTo62(o.umkm_user?.phone_number ?? "")}`,
      deliveryMethod: o.delivery_method,
      deliveryFee: o.delivery_fee ?? 0,
      grandTotal: o.grand_total ?? o.total_amount,
      createdAt: o.created_at,
    }));

    const fromPublic: UnifiedNegotiation[] = publicOffers.map(p => ({
      id: `OFFER-${p.id}`,
      source: "PUBLIC_OFFER",
      rawId: p.id,
      isNego: true,
      status:
        p.status === "PENDING"
          ? "WAITING_FARMER_NEGO_APPROVAL"
          : p.status === "ACCEPTED"
          ? "ACCEPTED"
          : "REJECTED",
      commodityName: p.commodity,
      quantityKg: p.quantity_kg,
      pricePerKg: p.proposed_price,
      originalPricePerKg: p.normal_price,
      negoReason: p.reason || null,
      rejectionReason: null,
      buyerName: p.buyer_name,
      buyerPhone: sanitizePhoneTo62(p.buyer_phone),
      buyerRegion: null,
      buyerWaUrl: `https://wa.me/${sanitizePhoneTo62(p.buyer_phone)}`,
      deliveryMethod: null,
      deliveryFee: null,
      grandTotal: p.proposed_price * p.quantity_kg,
      createdAt: p.created_at,
    }));

    const all = [...fromOrders, ...fromPublic].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const pendingCount = all.filter(
      n => n.status === "WAITING_FARMER_NEGO_APPROVAL" || n.status === "PENDING_FARMER_CONFIRMATION"
    ).length;

    return res.status(200).json({
      success: true,
      summary: {
        total: all.length,
        pending: pendingCount,
        negoCount: all.filter(n => n.isNego).length,
      },
      data: all,
    });
  } catch (error) {
    console.error("Error fetching farmer negotiations:", error);
    return res.status(500).json({ success: false, message: "Gagal mengambil data penawaran." });
  }
}

/**
 * POST /api/v1/farmer/negotiations/:id/decide
 * :id berformat "ORDER-<n>" atau "OFFER-<n>"; angka polos dianggap ORDER.
 * body: { action: 'ACCEPT' | 'REJECT', rejectionReason?: string }
 */
export async function respondToNegotiation(req: any, res: any) {
  try {
    const rawParam = String(req.params.id);
    const { action, rejectionReason } = req.body;
    const decision = String(action || "").toUpperCase();

    if (decision !== "ACCEPT" && decision !== "REJECT") {
      return res.status(400).json({ success: false, message: "Aksi tidak valid." });
    }

    const isPublicOffer = rawParam.startsWith("OFFER-");
    const numericId = Number(rawParam.replace(/^(ORDER-|OFFER-)/, ""));

    if (!numericId || Number.isNaN(numericId)) {
      return res.status(400).json({ success: false, message: "ID penawaran tidak valid." });
    }

    const sock = getSocket();

    // ---------- KANAL 2: Nego publik marketplace ----------
    if (isPublicOffer) {
      const offer = await prisma.priceNegotiation.findUnique({ where: { id: numericId } });
      if (!offer) {
        return res.status(404).json({ success: false, message: "Penawaran tidak ditemukan." });
      }
      if (offer.status !== "PENDING") {
        return res.status(409).json({
          success: false,
          message: `Penawaran sudah berstatus ${offer.status} dan tidak dapat diubah.`,
        });
      }

      const harvest = await prisma.harvestEvent.findUnique({
        where: { id: offer.harvest_event_id },
        include: { crop: { include: { user: true } } },
      });
      const farmer = harvest?.crop?.user;

      const updated = await prisma.priceNegotiation.update({
        where: { id: numericId },
        data: { status: decision === "ACCEPT" ? "ACCEPTED" : "REJECTED" },
      });

      if (sock && offer.buyer_phone) {
        const msg =
          decision === "ACCEPT"
            ? `🎉 *PENAWARAN NEGO DISETUJUI!* 🎉\n\n` +
              `Halo ${offer.buyer_name},\n` +
              `Penawaran harga *${rupiah(offer.proposed_price)}*/Kg untuk *${offer.commodity}* (${offer.quantity_kg} Kg) telah *DISETUJUI* oleh Pak/Bu *${farmer?.name ?? "Petani"}*.\n\n` +
              `💰 Total: *${rupiah(offer.proposed_price * offer.quantity_kg)}*\n\n` +
              `📲 Hubungi Petani: https://wa.me/${sanitizePhoneTo62(farmer?.phone_number ?? "")}`
            : `❌ *PENAWARAN NEGO DITOLAK*\n\n` +
              `Mohon maaf, penawaran harga untuk *${offer.commodity}* ditolak oleh Pak/Bu *${farmer?.name ?? "Petani"}*.\n\n` +
              `💬 *Alasan Penolakan Petani:*\n"${rejectionReason?.trim() || "Maaf, harga belum sesuai dengan biaya produksi di ladang."}"\n\n` +
              `Silakan cek komoditas lain di Web PetaniKita.`;
        // Kirim notifikasi dengan delay anti-spam (3 detik)
        sendNotificationWithDelay(sock, offer.buyer_phone, msg, 3000).catch(() => {});
      }

      logActivity({
        userId: farmer?.id,
        role: "PETANI",
        actorPhone: farmer?.phone_number,
        actorName: farmer?.name ?? "Petani",
        action: decision === "ACCEPT" ? "NEGO_ACCEPTED" : "NEGO_REJECTED",
        module: "ORDER",
        description:
          decision === "ACCEPT"
            ? `Petani "${farmer?.name ?? "-"}" MENYETUJUI penawaran publik #${numericId} dari "${offer.buyer_name}" (${offer.buyer_phone}): ${offer.commodity} ${offer.quantity_kg} Kg @ ${rupiah(offer.proposed_price)}/Kg.`
            : `Petani "${farmer?.name ?? "-"}" MENOLAK penawaran publik #${numericId} dari "${offer.buyer_name}" (${offer.buyer_phone}) untuk ${offer.commodity}. Alasan: "${rejectionReason?.trim() || "Harga belum sesuai biaya produksi"}".`,
        ipAddress: req.ip,
        userAgent: req.headers?.["user-agent"],
      });

      return res.status(200).json({
        success: true,
        message:
          decision === "ACCEPT" ? "Penawaran berhasil disetujui!" : "Penawaran ditolak.",
        data: updated,
      });
    }

    // ---------- KANAL 1: Order UMKM terdaftar ----------
    const order = await prisma.umkmOrder.findUnique({
      where: { id: numericId },
      include: {
        umkm_user: true,
        harvest_event: { include: { crop: { include: { user: true } } } },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order tidak ditemukan." });
    }
    if (order.status !== "PENDING_FARMER_CONFIRMATION" && order.status !== "WAITING_FARMER_NEGO_APPROVAL") {
      return res.status(409).json({
        success: false,
        message: `Pesanan sudah berstatus ${order.status} dan tidak dapat diubah.`,
      });
    }

    const farmer = order.harvest_event?.crop?.user;
    const commodity = order.harvest_event?.crop?.crop_type ?? "Komoditas";
    const umkmPhone = order.umkm_user?.phone_number ?? "";

    if (decision === "ACCEPT") {
      const updated = await prisma.umkmOrder.update({
        where: { id: numericId },
        data: { status: "ACCEPTED" },
      });

      if (sock && umkmPhone) {
        const acceptMsg =
          `🎉 *PENAWARAN NEGO DISETUJUI!* 🎉\n\n` +
          `Halo ${order.umkm_user?.name ?? "UMKM"},\n` +
          `Penawaran harga *${rupiah(order.price_per_kg ?? 0)}*/Kg untuk *${commodity}* (${order.amount_kg} Kg) telah *DISETUJUI* oleh Pak/Bu *${farmer?.name ?? "Petani"}*.\n\n` +
          `💰 Total: *${rupiah(order.grand_total ?? order.total_amount)}*\n` +
          `🚚 Metode: ${order.delivery_method === "COD_AMBIL_SENDIRI" ? "Ambil Sendiri ke Ladang (COD)" : "Diantar Petani"}\n\n` +
          `📲 Hubungi Petani: https://wa.me/${sanitizePhoneTo62(farmer?.phone_number ?? "")}`;
        // Kirim notifikasi dengan delay anti-spam (3 detik)
        sendNotificationWithDelay(sock, umkmPhone, acceptMsg, 3000).catch(() => {});
      }

      logActivity({
        userId: farmer?.id,
        role: "PETANI",
        actorPhone: farmer?.phone_number,
        actorName: farmer?.name ?? "Petani",
        action: "NEGO_ACCEPTED",
        module: "ORDER",
        description: `Petani "${farmer?.name ?? "-"}" MENYETUJUI nego order #${numericId} (${commodity}, ${order.amount_kg} Kg @ ${rupiah(order.price_per_kg ?? 0)}/Kg) dari UMKM "${order.umkm_user?.name ?? "-"}". Total ${rupiah(order.grand_total ?? order.total_amount)}.`,
        ipAddress: req.ip,
        userAgent: req.headers?.["user-agent"],
      });

      return res.status(200).json({
        success: true,
        message: "Penawaran berhasil disetujui!",
        data: updated,
      });
    }

    // REJECT — atomic: status REJECTED + kembalikan stok
    const { updatedOrder, restoredKg, reason } = await rejectOrderWithReason(
      numericId,
      rejectionReason || "Maaf, harga belum sesuai dengan biaya produksi di ladang."
    );

    if (sock && umkmPhone) {
      const rejectMsg =
        `❌ *PENAWARAN NEGO DITOLAK*\n\n` +
        `Mohon maaf, penawaran harga untuk *${commodity}* (${order.amount_kg} Kg) ditolak oleh Pak/Bu *${farmer?.name ?? "Petani"}*.\n\n` +
        `💬 *Alasan Penolakan Petani:*\n"${reason}"\n\n` +
        `Stok *${restoredKg} Kg* telah dikembalikan. Silakan cek komoditas lain di Web PetaniKita.`;
      // Kirim notifikasi dengan delay anti-spam (3 detik)
      sendNotificationWithDelay(sock, umkmPhone, rejectMsg, 3000).catch(() => {});
    }

    logActivity({
      userId: farmer?.id,
      role: "PETANI",
      actorPhone: farmer?.phone_number,
      actorName: farmer?.name ?? "Petani",
      action: "NEGO_REJECTED",
      module: "ORDER",
      description: `Petani "${farmer?.name ?? "-"}" MENOLAK nego order #${numericId} (${commodity}, ${restoredKg} Kg) dari UMKM "${order.umkm_user?.name ?? "-"}". Alasan: "${reason}". Stok dikembalikan.`,
      ipAddress: req.ip,
      userAgent: req.headers?.["user-agent"],
    });

    return res.status(200).json({
      success: true,
      message: `Penawaran ditolak dan stok ${restoredKg} Kg dikembalikan.`,
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Error processing negotiation decision:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Gagal memproses keputusan penawaran.",
    });
  }
}
