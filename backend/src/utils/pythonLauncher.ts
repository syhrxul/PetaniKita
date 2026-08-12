/**
 * Helper untuk panggil 9Router AI Parser (Python FastAPI / direct fetch) untuk region tertentu
 */
export async function execPythonAiFetcher(regionName: string): Promise<Array<{ commodity: string; price: number; prev_price: number }>> {
  try {
    const res = await fetch("https://9router.syhrulimtkhan.my.id/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer sk-92234d58ac30fd89-ek8z31-71e3c791",
      },
      body: JSON.stringify({
        model: "HarvestOS",
        messages: [
          { role: "system", content: "You are a price data JSON API. Output JSON array only." },
          {
            role: "user",
            content: `Return ONLY a RAW JSON Array without markdown or formatting of current & yesterday commodity prices per kg in IDR for ${regionName}. Format: [{"commodity":"Cabai Rawit Merah","price":28000,"prev_price":27500},{"commodity":"Bawang Merah","price":24000,"prev_price":25000},{"commodity":"Tomat Segar","price":12000,"prev_price":12000},{"commodity":"Cabai Merah Keriting","price":30000,"prev_price":29000},{"commodity":"Bawang Putih","price":35000,"prev_price":35000}]`,
          },
        ],
        temperature: 0.1,
        stream: false,
      }),
    });
    const data = (await res.json()) as any;
    let content = data.choices?.[0]?.message?.content?.trim() || "";
    if (content.startsWith("```")) {
      content = content.replace(/```json/g, "").replace(/```/g, "").trim();
    }
    return JSON.parse(content);
  } catch (err) {
    console.error(`9Router AI Fetcher Error for ${regionName}:`, err);
    return [
      { commodity: "Cabai Rawit Merah", price: 28000, prev_price: 27500 },
      { commodity: "Bawang Merah", price: 24000, prev_price: 25000 },
      { commodity: "Tomat Segar", price: 12000, prev_price: 12000 },
      { commodity: "Cabai Merah Keriting", price: 30000, prev_price: 29000 },
      { commodity: "Bawang Putih", price: 35000, prev_price: 35000 },
    ];
  }
}

export async function fetchPricesFromAI(regionName?: string): Promise<Array<{ commodity: string; price: number; prev_price: number }>> {
  try {
    console.log(`[AI PRICE ENGINE] Fetching regional prices for: ${regionName || "All Regions"}`);
    const targetRegion = regionName || "Kabupaten Sleman";
    const data = await execPythonAiFetcher(targetRegion);
    return data.map(item => ({
      commodity: item.commodity,
      price: item.price,
      prev_price: item.prev_price,
    }));
  } catch (err) {
    console.error("[AI PRICE ENGINE] Error in fetchPricesFromAI:", err);
    return [
      { commodity: "Cabai Rawit Merah", price: 45000, prev_price: 42000 },
      { commodity: "Bawang Merah", price: 32000, prev_price: 30000 },
      { commodity: "Tomat Segar", price: 15000, prev_price: 16000 },
      { commodity: "Cabai Merah Keriting", price: 38000, prev_price: 37000 },
      { commodity: "Bawang Putih", price: 35000, prev_price: 34000 },
      { commodity: "Kentang", price: 18000, prev_price: 17500 },
      { commodity: "Kol", price: 12000, prev_price: 12000 },
    ];
  }
}

export default {
  execPythonAiFetcher,
  fetchPricesFromAI,
};
