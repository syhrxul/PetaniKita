const ROUTER_API_URL = process.env.ROUTER_API_URL ?? "https://xchk.syhrulimtkhan.my.id/v1";
const ROUTER_API_KEY = process.env.ROUTER_API_KEY ?? "";
const ROUTER_MODEL = process.env.ROUTER_MODEL ?? "google/gemini-2.0-flash-001";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

function logError(msg: string) {
  console.error(`[PRICE_SCRAPER] ${msg}`);
}
function logInfo(msg: string) {
  console.info(`[PRICE_SCRAPER] ${msg}`);
}

/**
 * Kirim request ke 9Router AI API untuk scraping harga komoditas.
 */
async function chatWithAI(messages: ChatMessage[]): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    const response = await fetch(`${ROUTER_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ROUTER_API_KEY,
      },
      body: JSON.stringify({
        model: ROUTER_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 512,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`9Router API error: ${response.status}`);
    }

    const text = await response.text();

    // Handle streaming response (SSE format)
    if (text.startsWith("data:")) {
      const lines = text.split("\n").filter((l) => l.startsWith("data:"));
      let content = "";
      for (const line of lines) {
        try {
          const json = JSON.parse(line.replace("data: ", ""));
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) content += delta;
        } catch {
          // skip malformed lines
        }
      }
      return content;
    }

    // Handle regular JSON response
    const data = JSON.parse(text) as ChatResponse;
    return data.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    clearTimeout(timeout);
    logError(`9Router AI Error: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}

/**
 * Scrape harga komoditas dari AI berdasarkan nama komoditas dan wilayah.
 * Returns: { commodity, regionName, farmerPrice, umkmPrice, hapPrice, trend }
 */
export async function scrapePriceAI(
  commodity: string,
  regionName: string
): Promise<{
  commodity: string;
  regionName: string;
  farmerPrice: number;
  umkmPrice: number;
  hapPrice: number;
  trend: "UP" | "DOWN" | "STABLE";
  source: "AI_SCRAPE";
} | null> {
  try {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "Kamu adalah AI Price Engine PetaniKita. Tugasmu adalah memberikan estimasi harga komoditas pertanian di Indonesia saat ini. " +
          "Format response HARUS JSON murni tanpa markdown apapun. Contoh format:\n" +
          '{"farmerPrice": 35000, "umkmPrice": 42000, "hapPrice": 40000, "trend": "UP"}\n' +
          "farmerPrice = harga di tingkat petani (Rp/kg), umkmPrice = harga jual ke UMKM (Rp/kg), hapPrice = harga acuan pemerintah (Rp/kg). " +
          "trend hanya bisa UP, DOWN, atau STABLE. Berikan harga realistis berdasarkan data pasar terkini.",
      },
      {
        role: "user",
        content: `Berikan estimasi harga untuk komoditas "${commodity}" di wilayah "${regionName}" Indonesia. Response dalam format JSON murni.`,
      },
    ];

    const rawResponse = await chatWithAI(messages);

    // Parse JSON dari response AI
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI response tidak mengandung JSON yang valid");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      commodity,
      regionName,
      farmerPrice: Math.round(parsed.farmerPrice ?? 30000),
      umkmPrice: Math.round(parsed.umkmPrice ?? Math.round((parsed.farmerPrice ?? 30000) * 1.2)),
      hapPrice: Math.round(parsed.hapPrice ?? Math.round((parsed.farmerPrice ?? 30000) * 1.15)),
      trend: parsed.trend ?? "STABLE",
      source: "AI_SCRAPE" as const,
    };
  } catch (error) {
    logError(`Scrape Price AI Error for ${commodity} di ${regionName}: ${error instanceof Error ? error.message : error}`);
    // Fallback: return default price based on commodity type
    const defaultPrice = getDefaultPrice(commodity);
    return {
      commodity,
      regionName,
      farmerPrice: defaultPrice,
      umkmPrice: Math.round(defaultPrice * 1.2),
      hapPrice: Math.round(defaultPrice * 1.15),
      trend: "STABLE" as const,
      source: "AI_SCRAPE" as const,
    };
  }
}

/**
 * Get default price for a commodity when AI scraping fails.
 */
function getDefaultPrice(commodity: string): number {
  const defaults: Record<string, number> = {
    "Cabai Rawit Merah": 35000,
    "Cabai Merah Keriting": 32000,
    "Bawang Merah": 28000,
    "Bawang Putih": 35000,
    "Tomat Segar": 12000,
    "Kentang": 15000,
    "Wortel": 18000,
    "Kol": 8000,
    "Sawi": 10000,
  };
  return defaults[commodity] ?? 25000;
}

/**
 * Batch scrape harga untuk beberapa komoditas sekaligus.
 */
export async function batchScrapePrices(
  commodities: string[],
  regionName: string
): Promise<Array<{ commodity: string; regionName: string; farmerPrice: number; umkmPrice: number; hapPrice: number; trend: string; source: string }>> {
  const results: { commodity: string; regionName: string; farmerPrice: number; umkmPrice: number; hapPrice: number; trend: string; source: string }[] = [];

  for (const commodity of commodities) {
    const price = await scrapePriceAI(commodity, regionName);
    if (price) {
      results.push(price);
    }
    // Jeda agar tidak rate-limit
    await new Promise((r) => setTimeout(r, 500));
  }

  return results;
}

/**
 * Cek apakah komoditas sudah ada di database. Jika tidak, scrape harga baru.
 */
export async function ensurePriceExists(
  commodity: string,
  regionName: string,
  prisma: any
): Promise<void> {
  try {
    const existing = await prisma.priceHistory.findUnique({
      where: {
        regionName_commodity: { regionName, commodity },
      },
    });

    if (!existing) {
      logInfo(`[AI SCRAPE] Komoditas "${commodity}" belum ada di ${regionName}. Memulai scraping...`);
      const scraped = await scrapePriceAI(commodity, regionName);

      if (scraped) {
        await prisma.priceHistory.upsert({
          where: { regionName_commodity: { regionName, commodity } },
          update: {
            farmer_price: scraped.farmerPrice,
            umkm_price: scraped.umkmPrice,
            hap_price: scraped.hapPrice,
            trend: scraped.trend,
            updated_at: new Date(),
          },
          create: {
            regionName,
            commodity,
            farmer_price: scraped.farmerPrice,
            prev_price: scraped.farmerPrice,
            umkm_price: scraped.umkmPrice,
            hap_price: scraped.hapPrice,
            trend: scraped.trend,
          },
        });
        logInfo(`[AI SCRAPE] ✓ Harga "${commodity}" di ${regionName}: Rp ${scraped.farmerPrice.toLocaleString()}/Kg`);
      }
    }
  } catch (error) {
    logError(`[AI SCRAPE] Error ensuring price for ${commodity}: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Parse input panen dari pesan WhatsApp NLP dan cari harga AI.
 */
export async function parseHarvestAndFindPrice(
  commodityName: string,
  quantityKg: number,
  regionName: string
): Promise<{
  commodity: string;
  quantityKg: number;
  estimatedPricePerKg: number;
  estimatedTotalValue: number;
  regionName: string;
} | null> {
  try {
    // Pastikan harga ada di database (scrape jika belum)
    const { prisma } = await import("../lib/prisma.js");
    await ensurePriceExists(commodityName, regionName, prisma);

    const priceRecord = await prisma.priceHistory.findUnique({
      where: {
        regionName_commodity: { regionName, commodity: commodityName },
      },
    });

    const pricePerKg = priceRecord?.farmer_price ?? 30000;

    return {
      commodity: commodityName,
      quantityKg,
      estimatedPricePerKg: pricePerKg,
      estimatedTotalValue: Math.round(pricePerKg * quantityKg),
      regionName,
    };
  } catch (error) {
    logError(`Parse Harvest Error: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

export { chatWithAI };
