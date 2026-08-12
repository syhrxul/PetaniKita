export type DeliveryMethod = "DIANTAR_PETANI" | "COD_AMBIL_SENDIRI";

export const FREIGHT_BASE_RATE = 4000;
export const FREIGHT_COST_PER_KM = 1200;
export const FREIGHT_COST_PER_KG = 150;

/**
 * Menghitung Ongkir Adil Pengantaran Petani
 * Rumus: Base Rate (Rp 4.000) + (Jarak Km * Rp 1.200) + (Muatan Kg * Rp 150)
 * COD_AMBIL_SENDIRI selalu Rp 0 karena UMKM datang ke ladang.
 */
export function calculateFairDeliveryFee(
  distanceKm: number,
  quantityKg: number,
  method: DeliveryMethod
): number {
  if (method === "COD_AMBIL_SENDIRI") return 0;

  const safeDistance = Number.isFinite(distanceKm) ? Math.max(0, distanceKm) : 0;
  const safeWeight = Number.isFinite(quantityKg) ? Math.max(0, quantityKg) : 0;

  const rawFee =
    FREIGHT_BASE_RATE + safeDistance * FREIGHT_COST_PER_KM + safeWeight * FREIGHT_COST_PER_KG;

  // Bulatkan ke kelipatan 500 terdekat agar rapi
  return Math.round(rawFee / 500) * 500;
}

/**
 * Rincian ongkir untuk ditampilkan transparan ke UMKM & Petani
 */
export function buildFreightBreakdown(
  distanceKm: number,
  quantityKg: number,
  method: DeliveryMethod
) {
  const total = calculateFairDeliveryFee(distanceKm, quantityKg, method);
  return {
    method,
    distanceKm,
    quantityKg,
    baseRate: method === "COD_AMBIL_SENDIRI" ? 0 : FREIGHT_BASE_RATE,
    distanceCost: method === "COD_AMBIL_SENDIRI" ? 0 : Math.max(0, distanceKm) * FREIGHT_COST_PER_KM,
    weightCost: method === "COD_AMBIL_SENDIRI" ? 0 : Math.max(0, quantityKg) * FREIGHT_COST_PER_KG,
    total,
  };
}
