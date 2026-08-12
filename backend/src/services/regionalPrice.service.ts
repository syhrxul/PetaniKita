import { prisma } from "../lib/prisma.js";

/**
 * Mengambil daftar seluruh regionName unik yang terdaftar di database
 */
export async function getRegisteredRegionsFromDb(): Promise<string[]> {
  try {
    const userRegions = await prisma.user.findMany({
      select: { regionName: true },
      distinct: ["regionName"],
      where: {
        AND: [
          { regionName: { not: null } },
          { regionName: { not: "" } },
        ],
      },
    });

    const cropRegions = await prisma.farmCrop.findMany({
      select: { regionName: true },
      distinct: ["regionName"],
      where: {
        AND: [
          { regionName: { not: null } },
          { regionName: { not: "" } },
        ],
      },
    });

    const rawRegions = [
      ...userRegions.map(u => u.regionName),
      ...cropRegions.map(c => c.regionName),
    ];

    const regions = rawRegions
      .filter((region): region is string => Boolean(region && region.trim().length > 0))
      .map(r => r.trim());

    const uniqueRegions = Array.from(new Set(regions));

    // Jika DB masih kosong, gunakan default fallback daerah mitra utama
    return uniqueRegions.length > 0 ? uniqueRegions : ["Kabupaten Purbalingga"];
  } catch (error) {
    console.error("Error fetching registered regions from DB:", error);
    return ["Kabupaten Purbalingga"];
  }
}

/**
 * Fetch harga regional langsung dari PriceHistory di DB.
 * Jika suatu region belum ada data di DB, fallback ke harga default.
 */
export async function fetchAllRegisteredRegionalPrices() {
  try {
    // Baca langsung dari tabel price_histories — sumber kebenaran tunggal
    const records = await prisma.priceHistory.findMany({
      orderBy: [{ regionName: "asc" }, { commodity: "asc" }],
    });

    if (records.length > 0) {
      return records.map((p) => ({
        commodityName: p.commodity,
        pricePerKg: p.farmer_price,
        region: p.regionName,
        type: "DB_VERIFIED",
        commodity: p.commodity,
        farmer_price: p.farmer_price,
        prev_price: p.prev_price,
        umkm_price: p.umkm_price,
        hap_price: p.hap_price,
        trend: p.trend as "UP" | "DOWN" | "STABLE",
      }));
    }

    // Fallback: DB kosong, kembalikan harga default agar halaman tidak blank
    const activeRegions = await getRegisteredRegionsFromDb();
    const FALLBACK = [
      { commodity: "Cabai Rawit Merah", farmer_price: 32000, prev_price: 31000, umkm_price: 38400, hap_price: 36800, trend: "UP" as const },
      { commodity: "Bawang Merah",       farmer_price: 28000, prev_price: 27000, umkm_price: 33600, hap_price: 32200, trend: "UP" as const },
      { commodity: "Tomat Segar",        farmer_price: 12000, prev_price: 12500, umkm_price: 14400, hap_price: 13800, trend: "DOWN" as const },
      { commodity: "Bawang Putih",       farmer_price: 35000, prev_price: 35000, umkm_price: 42000, hap_price: 40250, trend: "STABLE" as const },
    ];

    return activeRegions.flatMap((region) =>
      FALLBACK.map((f) => ({ ...f, commodityName: f.commodity, pricePerKg: f.farmer_price, region, type: "FALLBACK" }))
    );
  } catch (error) {
    console.error("Error fetching all regional prices:", error);
    throw error;
  }
}
