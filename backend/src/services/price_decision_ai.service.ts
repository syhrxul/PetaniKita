import { prisma } from "../lib/prisma.js";

const ROUTER_URL = process.env.ROUTER_API_URL ?? "https://9router.syhrulimtkhan.my.id/v1";
const API_KEY = process.env.ROUTER_API_KEY ?? "";
const ROUTER_MODEL = process.env.ROUTER_MODEL ?? "Hervest";

export interface DecisionResult {
  recommendedPrice: number;
  rationale: string;
  impactLevel: "LOW" | "MEDIUM" | "HIGH";
}

/**
 * Panggil 9Router AI Decision Engine untuk menganalisis proposal petani vs harga acuan pasar
 */
export async function analyzePriceProposalAI(
  regionName: string,
  commodity: string,
  currentPrice: number,
  totalFarmers: number,
  avgProposedPrice: number,
  reasons: string[]
): Promise<DecisionResult> {
  const prompt = `You are an Executive Agricultural Economist AI for Indonesian Regional Government.
Analyze farmer price proposals vs official market rates.
Context:
- Region: ${regionName}
- Commodity: ${commodity}
- Current Official Price: Rp ${currentPrice}/kg
- Total Proposing Farmers: ${totalFarmers}
- Average Proposed Price: Rp ${avgProposedPrice}/kg
- Farmers Reasons: ${reasons.filter(Boolean).join("; ") || "Biaya produksi & pupuk naik"}

Return JSON ONLY:
{
  "recommendedPrice": float,
  "rationale": "string short economic justification",
  "impactLevel": "LOW" | "MEDIUM" | "HIGH"
}`;

  try {
    const res = await fetch(ROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify({
        model: ROUTER_MODEL,
        messages: [
          { role: "system", content: "You are an AI decision engine. Output JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        stream: false,
      }),
    });

    const text = await res.text();
    let content = "";

    // Handle streaming response (SSE format)
    if (text.startsWith("data:")) {
      const lines = text.split("\n").filter((l) => l.startsWith("data:"));
      for (const line of lines) {
        try {
          const json = JSON.parse(line.replace("data: ", ""));
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) content += delta;
        } catch {
          // skip
        }
      }
    } else {
      const data = JSON.parse(text) as any;
      content = data.choices?.[0]?.message?.content?.trim() || "";
    }

    if (content.startsWith("```")) {
      content = content.replace(/```json/g, "").replace(/```/g, "").trim();
    }
    return JSON.parse(content) as DecisionResult;
  } catch (err) {
    console.error("AI Decision Engine error, using economic fallback formula:", err);
    // Fallback: Rekomendasi 75% mendekati pengajuan petani agar adil
    const recommendedPrice = Math.round(currentPrice + (avgProposedPrice - currentPrice) * 0.75);
    return {
      recommendedPrice,
      rationale: `${totalFarmers} petani mengeluhkan kenaikan modal. Penyesuaian ke Rp ${recommendedPrice.toLocaleString()}/kg menutup biaya operasional petani tanpa memicu inflasi ekstrem bagi UMKM.`,
      impactLevel: avgProposedPrice > currentPrice * 1.2 ? "HIGH" : "MEDIUM",
    };
  }
}
