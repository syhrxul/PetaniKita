import { prisma } from "../lib/prisma.js";
import { execPythonAiFetcher } from "../utils/pythonLauncher.js";

/**
 * Pemicu On-Demand Discovery:
 * Jika daerah baru terdeteksi (0 data di MariaDB), jalankan 9Router AI Fetcher seketika!
 */
export async function ensureRegionPriceExists(regionName: string) {
  if (!regionName || regionName === "Kabupaten Lokal") return;

  const normalizedRegion = regionName.trim();

  // 1. Cek apakah sudah ada data harga di MariaDB untuk region ini
  const existingCount = await prisma.priceHistory.count({
    where: { regionName: normalizedRegion },
  });

  // 2. JIKA BELUM ADA (0 Data) -> Trigger 9Router AI Fetcher Seketika (Instant On-Demand)
  if (existingCount === 0) {
    console.log(`✨ Daerah Baru Terdeteksi: "${normalizedRegion}". Memulai On-Demand 9Router AI Fetch...`);

    try {
      const aiParsedData = await execPythonAiFetcher(normalizedRegion);

      if (aiParsedData && Array.isArray(aiParsedData)) {
        for (const item of aiParsedData) {
          const farmerPrice = item.price;
          const prevPrice = item.prev_price || farmerPrice * 0.98;
          const umkmPrice = Math.round(farmerPrice * 1.2);
          const hapPrice = Math.round(farmerPrice * 1.15);
          const trend = farmerPrice > prevPrice ? "UP" : farmerPrice < prevPrice ? "DOWN" : "STABLE";

          await prisma.priceHistory.upsert({
            where: {
              regionName_commodity: {
                regionName: normalizedRegion,
                commodity: item.commodity,
              },
            },
            update: {
              farmer_price: farmerPrice,
              prev_price: prevPrice,
              umkm_price: umkmPrice,
              hap_price: hapPrice,
              trend,
              updated_at: new Date(),
            },
            create: {
              regionName: normalizedRegion,
              commodity: item.commodity,
              farmer_price: farmerPrice,
              prev_price: prevPrice,
              umkm_price: umkmPrice,
              hap_price: hapPrice,
              trend,
            },
          });
        }
        console.log(`✅ Sukses inisialisasi harga On-Demand untuk daerah: "${normalizedRegion}"`);
      }
    } catch (err) {
      console.error(`❌ Gagal On-Demand fetching untuk ${normalizedRegion}:`, err);
    }
  }
}

/**
 * Batch Cron Job (12-Hour Sync All Regions):
 * Mengumpulkan seluruh regionName unik dari tabel `users` dan `farm_crops`,
 * lalu memperbarui data harga daerah tersebut dalam 1 siklus batch.
 */
export async function run12HourBatchCron() {
  console.log("⏰ Memulai 12-Hour Batch Cron Job Update Harga Pangan Regional...");

  try {
    // 1. Ambil seluruh regionName unik dari MariaDB users & farm_crops
    const userRegions = await prisma.user.findMany({
      select: { regionName: true },
      where: { regionName: { not: null } },
      distinct: ["regionName"],
    });

    const cropRegions = await prisma.farmCrop.findMany({
      select: { regionName: true },
      where: { regionName: { not: null } },
      distinct: ["regionName"],
    });

    const allRegions = new Set<string>();
    userRegions.forEach(u => u.regionName && allRegions.add(u.regionName));
    cropRegions.forEach(c => c.regionName && allRegions.add(c.regionName));

    if (allRegions.size === 0) {
      allRegions.add("Kabupaten Sleman");
    }

    console.log(`📋 Total ${allRegions.size} daerah unik terdaftar:`, Array.from(allRegions));

    // 2. Batch update per region
    for (const regionName of allRegions) {
      console.log(`🔄 [Batch Update] Region: "${regionName}"...`);
      const aiParsedData = await execPythonAiFetcher(regionName);

      if (aiParsedData && Array.isArray(aiParsedData)) {
        for (const item of aiParsedData) {
          // Cek apakah komoditas di daerah ini sedang dikunci oleh Superadmin
          const existing = await prisma.priceHistory.findUnique({
            where: {
              regionName_commodity: { regionName, commodity: item.commodity },
            },
          });

          // JIKA isCustomLocked == true AND lockUntil > NOW() -> SKIP OVERWRITE (Pertahankan harga kustom Superadmin!)
          if (
            existing &&
            existing.isCustomLocked &&
            existing.lockUntil &&
            new Date(existing.lockUntil) > new Date()
          ) {
            console.log(`🔒 [SKIP OVERWRITE] ${regionName} - ${item.commodity} dikunci Superadmin sampai ${existing.lockUntil}`);
            continue;
          }

          const farmerPrice = item.price;
          const prevPrice = item.prev_price || farmerPrice * 0.98;
          const umkmPrice = Math.round(farmerPrice * 1.2);
          const hapPrice = Math.round(farmerPrice * 1.15);
          const trend = farmerPrice > prevPrice ? "UP" : farmerPrice < prevPrice ? "DOWN" : "STABLE";

          await prisma.priceHistory.upsert({
            where: {
              regionName_commodity: {
                regionName,
                commodity: item.commodity,
              },
            },
            update: {
              farmer_price: farmerPrice,
              prev_price: prevPrice,
              umkm_price: umkmPrice,
              hap_price: hapPrice,
              trend,
              isCustomLocked: false,
              lockUntil: null,
              updated_at: new Date(),
            },
            create: {
              regionName,
              commodity: item.commodity,
              farmer_price: farmerPrice,
              prev_price: prevPrice,
              umkm_price: umkmPrice,
              hap_price: hapPrice,
              trend,
            },
          });
        }
      }
    }

    console.log("✅ 12-Hour Batch Cron Job Selesai!");
  } catch (err) {
    console.error("❌ 12-Hour Batch Cron Job Error:", err);
  }
}
