import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { fetchRealtimeMultiSourcePrice } from "./ai.service.js";

const DEFAULT_COMMODITIES = [
  "Cabai Rawit Merah",
  "Bawang Merah",
  "Beras Medium",
  "Tomat",
  "Jagung Pipilan",
];

/**
 * Dynamic Multi-Source Realtime Price Scraper.
 * Mengambil SELURUH regionName unik milik user/petani terdaftar di MariaDB,
 * lalu memanggil AI HarvestOS (9Router Proxy) untuk harga real-time multi-sumber.
 */
export async function runDynamicMultiSourcePriceScraper() {
  const nowWib = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  console.log(`⏰ [CRON JOB STARTED] Memulai Multi-Source Price Scraper pada: ${nowWib} WIB`);

  try {
    // 1. Ambil seluruh regionName unik dari tabel User & HarvestEvent
    const registeredUsers = await prisma.user.findMany({
      where: { regionName: { not: null } },
      select: { regionName: true },
      distinct: ["regionName"],
    });

    const activeRegions = Array.from(
      new Set(registeredUsers.map(u => u.regionName).filter(Boolean))
    ) as string[];

    // Fallback jika DB belum memiliki data daerah
    if (activeRegions.length === 0) {
      activeRegions.push("Kabupaten Sleman", "Kabupaten Bantul");
    }

    console.log(`🔍 [TARGET REGIONS] Menelusuri ${activeRegions.length} daerah:`, activeRegions);

    // 2. Iterasi untuk setiap daerah dan komoditas
    for (const region of activeRegions) {
      for (const commodity of DEFAULT_COMMODITIES) {
        try {
          console.log(`📡 Scraping data real-time: ${commodity} @ ${region}...`);

          const aiData = await fetchRealtimeMultiSourcePrice(commodity, region);

          if (aiData && aiData.farmerPrice > 0) {
            // Cek rekord harga terakhir di database
            const existingRecord = await prisma.priceHistory.findUnique({
              where: { regionName_commodity: { regionName: region, commodity } },
            });

            // JIKA dikunci Superadmin (isCustomLocked & lockUntil > NOW) -> SKIP OVERWRITE
            if (
              existingRecord &&
              existingRecord.isCustomLocked &&
              existingRecord.lockUntil &&
              new Date(existingRecord.lockUntil) > new Date()
            ) {
              console.log(`🔒 [SKIP OVERWRITE] ${commodity} (${region}) dikunci Superadmin.`);
              continue;
            }

            const isPriceChanged =
              !existingRecord ||
              Number(existingRecord.farmer_price) !== Number(aiData.farmerPrice) ||
              Number(existingRecord.hap_price) !== Number(aiData.hapPrice);

            if (isPriceChanged) {
              console.log(`💡 [PRICE CHANGE DETECTED] ${commodity} (${region}): Rp ${aiData.farmerPrice.toLocaleString()}. Menyimpan ke MariaDB...`);

              const prevPrice = existingRecord?.farmer_price ?? aiData.farmerPrice;
              const umkmPrice = Math.round(aiData.farmerPrice * 1.2);
              const trend = aiData.trend || (aiData.farmerPrice > prevPrice ? "UP" : aiData.farmerPrice < prevPrice ? "DOWN" : "STABLE");

              await prisma.priceHistory.upsert({
                where: { regionName_commodity: { regionName: region, commodity } },
                update: {
                  farmer_price: aiData.farmerPrice,
                  prev_price: prevPrice,
                  umkm_price: umkmPrice,
                  hap_price: aiData.hapPrice,
                  trend,
                  updated_at: new Date(),
                },
                create: {
                  regionName: region,
                  commodity,
                  farmer_price: aiData.farmerPrice,
                  prev_price: aiData.farmerPrice,
                  umkm_price: umkmPrice,
                  hap_price: aiData.hapPrice,
                  trend,
                  updated_at: new Date(),
                },
              });

              // Log Aktivitas Audit
              await prisma.auditLog.create({
                data: {
                  action: "PRICE_REALTIME_SCRAPED",
                  module: "PRICE_ENGINE",
                  description: `Harga ${commodity} di ${region} diperbarui real-time pada ${nowWib} WIB dari sumber [${aiData.scrapedSources.join(", ")}] menjadi Rp ${aiData.farmerPrice.toLocaleString()}/Kg (HAP Rp ${aiData.hapPrice.toLocaleString()}, trend ${trend}). Catatan: ${aiData.notes || "-"}`,
                },
              });
            } else {
              console.log(`ℹ️ [NO CHANGE] ${commodity} (${region}) tetap Rp ${aiData.farmerPrice.toLocaleString()}. DB tidak diperbarui.`);
            }
          }
        } catch (itemErr: any) {
          console.warn(`⚠️ Gagal scraping ${commodity} di ${region}:`, itemErr?.message || itemErr);
        }
      }
    }

    console.log(`✅ [CRON JOB FINISHED] Seluruh daerah berhasil di-scrape pada: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`);
  } catch (err: any) {
    console.error("❌ [CRON FATAL ERROR]:", err?.message || err);
  }
}

// Inisialisasi Cron Schedule (Pukul 00:00 WIB & 12:00 WIB)
export function initPriceScraperCron() {
  cron.schedule(
    "0 0,12 * * *",
    () => {
      runDynamicMultiSourcePriceScraper();
    },
    {
      timezone: "Asia/Jakarta",
    }
  );

  console.log("🚀 [CRON SCHEDULED] Dynamic Multi-Source Realtime Price Scraper Aktif (Jam 00:00 & 12:00 WIB).");
}
