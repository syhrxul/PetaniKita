import { prisma } from "../lib/prisma.js";
import { logger } from "../utils/logger.js";
import { recordAuditLog } from "../services/auditLog.service.js";

/**
 * PATCH /api/v1/orders/:id/aggregator-update
 * Tengkulak mengupdate Biaya Jasa Angkut dan Timbangan Riil
 */
export async function updateOrderByAggregator(req: any, res: any) {
  try {
    const { id } = req.params;
    const { deliveryFee, actualWeightKg } = req.body;
    const orderId = Number(id);

    const order = await prisma.umkmOrder.findUnique({
      where: { id: orderId },
      include: { harvest_event: { include: { crop: true } } },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order tidak ditemukan." });
    }

    const priceRecord = await prisma.priceHistory.findFirst({
      where: { commodity: order.harvest_event?.crop?.crop_type ?? "" },
      orderBy: { updated_at: "desc" },
    });
    const pricePerKg = priceRecord?.farmer_price ?? 28000;

    const oldWeight = order.amount_kg;
    const newWeight = actualWeightKg !== undefined ? Number(actualWeightKg) : oldWeight;
    const diffKg = oldWeight - newWeight;
    const newDeliveryFee = deliveryFee !== undefined ? Number(deliveryFee) : (order.delivery_fee ?? 0);
    const newFoodTotal = newWeight * pricePerKg;
    const newGrandTotal = newFoodTotal + newDeliveryFee;

    const [updated] = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.umkmOrder.update({
        where: { id: orderId },
        data: {
          amount_kg: newWeight,
          delivery_fee: newDeliveryFee,
          food_total_price: newFoodTotal,
          grand_total: newGrandTotal,
          total_amount: newGrandTotal,
        },
      });

      if (diffKg !== 0 && order.harvest_event_id) {
        await tx.harvestEvent.update({
          where: { id: order.harvest_event_id },
          data: {
            est_yield_kg: { increment: diffKg },
          },
        });
      }

      return [updatedOrder];
    });

    recordAuditLog({
      action: "AGGREGATOR_UPDATE_ORDER",
      method: "PATCH",
      path: `/api/v1/orders/${orderId}/aggregator-update`,
      statusCode: 200,
      details: { orderId, deliveryFee: newDeliveryFee, actualWeightKg: newWeight },
      ipAddress: req.ip,
    });

    logger.info({ action: "AGGREGATOR_UPDATE_ORDER", orderId }, `[ORDER] Order #${orderId} diperbarui oleh Tengkulak`);

    return res.status(200).json({
      success: true,
      message: "Rincian biaya jasa & muatan berhasil diperbarui oleh Tengkulak.",
      data: updated,
    });
  } catch (error) {
    console.error("Error update by aggregator:", error);
    return res.status(500).json({ success: false, message: "Gagal memperbarui order." });
  }
}

/**
 * PATCH /api/v1/orders/:id/umkm-update
 * UMKM mengupdate Kuantitas, Metode Pembayaran, dan Mode Pengambilan
 */
export async function updateOrderByUmkm(req: any, res: any) {
  try {
    const { id } = req.params;
    const { quantityKg, paymentMethod, isSelfPickup } = req.body;
    const orderId = Number(id);

    const order = await prisma.umkmOrder.findUnique({
      where: { id: orderId },
      include: { harvest_event: { include: { crop: true } } },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order tidak ditemukan." });
    }

    const priceRecord = await prisma.priceHistory.findFirst({
      where: { commodity: order.harvest_event?.crop?.crop_type ?? "" },
      orderBy: { updated_at: "desc" },
    });
    const pricePerKg = priceRecord?.farmer_price ?? 28000;

    const oldQty = order.amount_kg;
    const newQty = quantityKg !== undefined ? Number(quantityKg) : oldQty;
    const diffKg = oldQty - newQty;
    const newDeliveryFee = isSelfPickup ? 0 : (order.delivery_fee ?? 0);
    const newFoodTotal = newQty * pricePerKg;
    const newGrandTotal = newFoodTotal + newDeliveryFee;

    const [updated] = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.umkmOrder.update({
        where: { id: orderId },
        data: {
          amount_kg: newQty,
          payment_method: paymentMethod || order.payment_method,
          delivery_fee: newDeliveryFee,
          food_total_price: newFoodTotal,
          grand_total: newGrandTotal,
          total_amount: newGrandTotal,
          is_self_pickup: isSelfPickup !== undefined ? isSelfPickup : order.is_self_pickup,
        },
      });

      if (diffKg !== 0 && order.harvest_event_id) {
        await tx.harvestEvent.update({
          where: { id: order.harvest_event_id },
          data: {
            est_yield_kg: { increment: diffKg },
          },
        });
      }

      return [updatedOrder];
    });

    recordAuditLog({
      action: "UMKM_UPDATE_ORDER",
      method: "PATCH",
      path: `/api/v1/orders/${orderId}/umkm-update`,
      statusCode: 200,
      details: { orderId, quantityKg: newQty, paymentMethod, isSelfPickup },
      ipAddress: req.ip,
    });

    logger.info({ action: "UMKM_UPDATE_ORDER", orderId }, `[ORDER] Order #${orderId} diperbarui oleh UMKM`);

    return res.status(200).json({
      success: true,
      message: "Pesanan berhasil disesuaikan oleh UMKM.",
      data: updated,
    });
  } catch (error) {
    console.error("Error update by UMKM:", error);
    return res.status(500).json({ success: false, message: "Gagal memperbarui pesanan." });
  }
}
