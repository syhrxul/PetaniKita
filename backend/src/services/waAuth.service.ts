import { prisma } from "../lib/prisma.js";
import { sanitizePhoneTo62 } from "../utils/phoneSanitizer.js";
import { scrapePriceAI, ensurePriceExists } from "./priceScraperAI.service.js";
function logError(msg: string) {
  console.error(`[WA_AUTH] ${msg}`);
}
function logInfo(msg: string) {
  console.info(`[WA_AUTH] ${msg}`);
}

const FRONTEND_URL = (process.env.FRONTEND_URL || "https://xc4v9xjv-3000.asse.devtunnels.ms").replace(/\/+$/, "");

/**
 * Build link untuk share lokasi GPS (WhatsApp Location Invite)
 */
export function buildShareLocationLink(token: string): string {
  return `${FRONTEND_URL}/share-location?token=${token}`;
}

/**
 * Handle WhatsApp Auth Flow: Register / Login
 */
export async function handleWaAuthFlow(
  sock: any,
  remoteJid: string,
  senderLid: string,
  waReg: any,
  cleanBody: string
): Promise<boolean> {
  const step = waReg.step;

  // Step: PILIH_ROLE -> tampilkan pilihan PETANI/UMKM
  if (step === "AWAITING_ROLE") {
    const selectedRole = cleanBody === "1" ? "PETANI" : cleanBody === "2" ? "UMKM" : null;

    if (!selectedRole) {
      await sock.sendMessage(remoteJid, {
        text: `⚠️ *Pilihan tidak valid.*\nMohon balas dengan angka *1* (Petani) atau *2* (UMKM).`,
      });
      return true;
    }

    await prisma.waRegistration.update({
      where: { waLid: senderLid },
      data: { role: selectedRole, step: "AWAITING_NAME" },
    });

    await sock.sendMessage(remoteJid, {
      text:
        `✅ Peran dipilih: *${selectedRole}*\n\n` +
        `Silakan ketik *Nama Lengkap* Anda:`,
    });
    return true;
  }

  // Step: INPUT_NAMA
  if (step === "AWAITING_NAME") {
    if (cleanBody.length < 3) {
      await sock.sendMessage(remoteJid, {
        text: `⚠️ Nama terlalu pendek. Silakan masukkan *Nama Lengkap* Anda:`,
      });
      return true;
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
    return true;
  }

  // Step: INPUT_PHONE -> selesai daftar, minta lokasi
  if (step === "AWAITING_PHONE") {
    const sanitizedPhone = sanitizePhoneTo62(cleanBody);

    if (sanitizedPhone.length < 10) {
      await sock.sendMessage(remoteJid, {
        text: `⚠️ Format nomor HP tidak valid. Masukkan nomor WhatsApp yang benar (Contoh: 081229411387):`,
      });
      return true;
    }

    await prisma.waRegistration.update({
      where: { waLid: senderLid },
      data: { phone: sanitizedPhone, step: "AWAITING_LOCATION" },
    });

    await sock.sendMessage(remoteJid, {
      text:
        `🎉 *PENDAFTARAN AWAL BERHASIL!*\n\n` +
        `• Nama: *${waReg.name}*\n` +
        `• Peran: *${waReg.role}*\n` +
        `• No HP: *${sanitizedPhone}*\n\n` +
        `📌 *SATU LANGKAH TERAKHIR:*\n` +
        `Klik link di bawah ini untuk *mengirimkan lokasi ladang/toko* Anda:\n\n` +
        `👉 ${buildShareLocationLink(senderLid)}\n\n` +
        `_Setelah klik, izinkan browser mengakses GPS Anda, lalu klik "Kirim Lokasi"._`,
    });
    return true;
  }

  return false;
}

/**
 * Cari harga komoditas menggunakan AI berdasarkan region user.
 */
export async function findPriceByRegion(
  commodity: string,
  userPhone: string
): Promise<{
  commodity: string;
  regionName: string;
  farmerPrice: number;
  umkmPrice: number;
  hapPrice: number;
  trend: string;
} | null> {
  try {
    // Cari user berdasarkan phone
    const user = await prisma.user.findUnique({
      where: { phone_number: userPhone },
    });

    const region = user?.regionName ?? "Indonesia";

    // Pastikan harga ada (scrape jika belum)
    await ensurePriceExists(commodity, region, prisma);

    const priceRecord = await prisma.priceHistory.findUnique({
      where: {
        regionName_commodity: { regionName: region, commodity },
      },
    });

    if (priceRecord) {
      return {
        commodity,
        regionName: region,
        farmerPrice: priceRecord.farmer_price,
        umkmPrice: priceRecord.umkm_price,
        hapPrice: priceRecord.hap_price,
        trend: priceRecord.trend,
      };
    }

    // Fallback: scrape langsung
    const scraped = await scrapePriceAI(commodity, region);
    if (scraped) {
      return {
        commodity: scraped.commodity,
        regionName: scraped.regionName,
        farmerPrice: scraped.farmerPrice,
        umkmPrice: scraped.umkmPrice,
        hapPrice: scraped.hapPrice,
        trend: scraped.trend,
      };
    }

    return null;
  } catch (error) {
    logError(`Find Price Error: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

/**
 * Auto-scrape harga di wilayah user baru setelah registrasi berhasil.
 */
export async function autoScrapeOnRegistration(phone: string, regionName: string): Promise<void> {
  const defaultCommodities = [
    "Cabai Rawit Merah",
    "Cabai Merah Keriting",
    "Bawang Merah",
    "Bawang Putih",
    "Tomat Segar",
    "Kentang",
    "Wortel",
  ];

  logInfo(`[AUTO SCRAPE] Memulai scraping harga untuk wilayah: ${regionName}`);

  for (const commodity of defaultCommodities) {
    await ensurePriceExists(commodity, regionName, prisma);
    await new Promise((r) => setTimeout(r, 400));
  }

  logInfo(`[AUTO SCRAPE] ✓ Selesai scraping ${defaultCommodities.length} komoditas di ${regionName}`);
}

/**
 * Parse pesan WhatsApp NLP untuk input panen + cari harga AI.
 */
export async function parseHarvestMessageWithPrice(
  message: string,
  userPhone: string
): Promise<{
  commodity: string;
  quantityKg: number;
  pricePerKg: number;
  totalValue: number;
  regionName: string;
} | null> {
  try {
    // Parse basic harvest info dari pesan
    const harvestInfo = await parseHarvestBasic(message);
    if (!harvestInfo) return null;

    // Cari harga berdasarkan region user
    const priceInfo = await findPriceByRegion(harvestInfo.commodity, userPhone);

    if (priceInfo) {
      return {
        commodity: harvestInfo.commodity,
        quantityKg: harvestInfo.quantityKg,
        pricePerKg: priceInfo.farmerPrice,
        totalValue: Math.round(priceInfo.farmerPrice * harvestInfo.quantityKg),
        regionName: priceInfo.regionName,
      };
    }

    return {
      commodity: harvestInfo.commodity,
      quantityKg: harvestInfo.quantityKg,
      pricePerKg: 30000,
      totalValue: Math.round(30000 * harvestInfo.quantityKg),
      regionName: "Indonesia",
    };
  } catch (error) {
    logError(`Parse Harvest NLP Error: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

/**
 * Parse basic harvest info dari pesan NLP sederhana.
 * Contoh: "panen cabai rawit 100 kg harga 35rb"
 */
async function parseHarvestBasic(message: string): Promise<{ commodity: string; quantityKg: number } | null> {
  const lower = message.toLowerCase();

  // Pattern matching sederhana untuk komoditas
  const commodityPatterns: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /cabai\s+rawit/i, name: "Cabai Rawit Merah" },
    { pattern: /cabai\s+keriting/i, name: "Cabai Merah Keriting" },
    { pattern: /cabai/i, name: "Cabai Rawit Merah" },
    { pattern: /bawang\s+merah/i, name: "Bawang Merah" },
    { pattern: /bawang\s+putih/i, name: "Bawang Putih" },
    { pattern: /bawang/i, name: "Bawang Merah" },
    { pattern: /tomat/i, name: "Tomat Segar" },
    { pattern: /kentang/i, name: "Kentang" },
    { pattern: /wortel/i, name: "Wortel" },
    { pattern: /kol/i, name: "Kol" },
    { pattern: /sawi/i, name: "Sawi" },
  ];

  let commodity = "";
  for (const { pattern, name } of commodityPatterns) {
    if (pattern.test(lower)) {
      commodity = name;
      break;
    }
  }

  if (!commodity) return null;

  // Extract quantity (kg)
  const qtyMatch = lower.match(/(\d+)\s*(kg|kilo|kilogram)/i);
  const quantityKg = qtyMatch ? parseInt(qtyMatch[1]) : 0;

  if (quantityKg <= 0) return null;

  return { commodity, quantityKg };
}

export { FRONTEND_URL };
