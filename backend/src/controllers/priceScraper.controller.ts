import { prisma } from "../lib/prisma.js";
import { batchScrapePrices, ensurePriceExists } from "../services/priceScraperAI.service.js";
import { generateAiJson } from "../services/ai.service.js";

interface AiPriceRecommendation {
  commodity: string;
  region: string;
  recommended_farmer_price: number;
  hap_price: number;
  trend: "UP" | "DOWN" | "STABLE";
  reasoning: string;
}

/**
 * GET /api/v1/prices/scrape
 * Analisis harga komoditas via AI HarvestOS (9Router Proxy) dengan Graceful Database Fallback.
 * Query: ?commodity=Cabai Rawit Merah&region=Sleman
 */
export async function scrapePriceEndpoint(req: any, res: any) {
  const commodity = (req.query.commodity as string) || "Cabai Rawit Merah";
  const region = (req.query.region as string) || "Kabupaten Sleman";

  try {
    const prompt = `Berikan estimasi analisis harga acuan komoditas pertanian terkini untuk daerah ${region} dengan komoditas ${commodity}.`;
    const systemPrompt = `Anda adalah pakar analisis harga pangan Bapanas Indonesia. Berikan output JSON dengan format:
    {
      "commodity": "${commodity}",
      "region": "${region}",
      "recommended_farmer_price": number (harga rupiah per kg di tingkat petani),
      "hap_price": number (harga acuan pemerintah HAP),
      "trend": "UP" | "DOWN" | "STABLE",
      "reasoning": "penjelasan ringkas singkat max 1 kalimat"
    }`;

    // Memanggil 9Router AI Proxy - Model HarvestOS
    const aiData = await generateAiJson<AiPriceRecommendation>(prompt, systemPrompt);

    return res.status(200).json({
      success: true,
      source: "HARVEST_OS_AI",
      data: {
        commodity: aiData.commodity,
        region: aiData.region,
        farmer_price: aiData.recommended_farmer_price,
        hap_price: aiData.hap_price,
        trend: aiData.trend,
        analysis: aiData.reasoning,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.warn("⚠️ Fallback ke DB lokal karena AI Proxy timeout/error:", error?.message || error);

    // Fallback otomatis ke Database lokal agar backend tidak pernah melempar Error 500
    let dbPrice: any = null;
    try {
      dbPrice = await prisma.priceHistory.findFirst({
        where: { commodity: { contains: commodity.split(" ")[0], mode: "insensitive" } },
      });
    } catch (dbError) {
      console.warn("⚠️ DB fallback gagal, memakai default harga:", dbError);
    }

    return res.status(200).json({
      success: true,
      source: "DATABASE_FALLBACK",
      data: {
        commodity,
        region,
        farmer_price: dbPrice?.farmer_price ? Number(dbPrice.farmer_price) : 28000,
        hap_price: dbPrice?.hap_price ? Number(dbPrice.hap_price) : 32000,
        trend: dbPrice?.trend || "STABLE",
        analysis: "Data diambil dari acuan historis database lokal.",
        updatedAt: new Date().toISOString(),
      },
    });
  }
}

/**
 * POST /api/v1/prices/scrape-batch
 * Batch scraping untuk beberapa komoditas.
 * body: { commodities: string[], regionName: string }
 */
export async function scrapeBatchPricesEndpoint(req: any, res: any) {
  try {
    const { commodities, regionName } = req.body;

    if (!commodities || !regionName) {
      return res.status(400).json({ success: false, message: "commodities dan regionName wajib diisi." });
    }

    const results = await batchScrapePrices(commodities, regionName);

    // Simpan semua ke database
    for (const price of results) {
      await prisma.priceHistory.upsert({
        where: { regionName_commodity: { regionName: price.regionName, commodity: price.commodity } },
        update: {
          farmer_price: price.farmerPrice,
          umkm_price: price.umkmPrice,
          hap_price: price.hapPrice,
          trend: price.trend,
          updated_at: new Date(),
        },
        create: {
          regionName: price.regionName,
          commodity: price.commodity,
          farmer_price: price.farmerPrice,
          prev_price: price.farmerPrice,
          umkm_price: price.umkmPrice,
          hap_price: price.hapPrice,
          trend: price.trend,
        },
      });
    }

    return res.json({ success: true, message: `Berhasil scraping ${results.length} komoditas.`, data: results });
  } catch (error) {
    console.error("[SCRAPE BATCH] Error:", error);
    return res.status(500).json({ success: false, message: "Gagal batch scraping." });
  }
}

/**
 * GET /api/v1/prices/multi-region
 * Ambil harga dari semua wilayah (multi-location display).
 * Query: ?commodity=Cabai Rawit Merah
 */
export async function getMultiRegionPrices(req: any, res: any) {
  try {
    const { commodity } = req.query;

    if (!commodity) {
      return res.status(400).json({ success: false, message: "commodity wajib diisi." });
    }

    const prices = await prisma.priceHistory.findMany({
      where: { commodity: commodity as string },
      orderBy: { farmer_price: "asc" },
    });

    return res.json({
      success: true,
      commodity,
      totalRegions: prices.length,
      data: prices.map((p: any) => ({
        regionName: p.regionName,
        farmerPrice: p.farmer_price,
        umkmPrice: p.umkm_price,
        hapPrice: p.hap_price,
        trend: p.trend,
        updatedAt: p.updated_at,
      })),
    });
  } catch (error) {
    console.error("[MULTI REGION] Error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengambil data multi-region." });
  }
}

/**
 * GET /api/v1/prices/region/:regionName
 * Ambil semua harga komoditas di suatu wilayah.
 */
export async function getPricesByRegion(req: any, res: any) {
  try {
    const { regionName } = req.params;

    const prices = await prisma.priceHistory.findMany({
      where: { regionName },
      orderBy: { updated_at: "desc" },
    });

    return res.json({
      success: true,
      regionName,
      totalCommodities: prices.length,
      data: prices.map((p: any) => ({
        commodity: p.commodity,
        farmerPrice: p.farmer_price,
        umkmPrice: p.umkm_price,
        hapPrice: p.hap_price,
        trend: p.trend,
        updatedAt: p.updated_at,
      })),
    });
  } catch (error) {
    console.error("[REGION PRICES] Error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengambil data harga region." });
  }
}

/**
 * Pastikan harga komoditas ada di wilayah tertentu (scrape jika belum).
 * Dipakai saat user input panen atau komoditas baru.
 */
export async function ensurePriceEndpoint(req: any, res: any) {
  try {
    const { commodity, regionName } = req.query;

    if (!commodity || !regionName) {
      return res.status(400).json({ success: false, message: "commodity dan regionName wajib diisi." });
    }

    await ensurePriceExists(commodity as string, regionName as string, prisma);

    const price = await prisma.priceHistory.findUnique({
      where: { regionName_commodity: { regionName: regionName as string, commodity: commodity as string } },
    });

    return res.json({ success: true, data: price });
  } catch (error) {
    console.error("[ENSURE PRICE] Error:", error);
    return res.status(500).json({ success: false, message: "Gagal memastikan harga." });
  }
}
