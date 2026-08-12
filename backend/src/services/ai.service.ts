import OpenAI from "openai";

// Inisialisasi OpenAI SDK yang di-pointing ke 9Router Proxy
const openai = new OpenAI({
  baseURL: process.env.AI_BASE_URL || "https://9router.syhrulimtkhan.my.id/v1",
  apiKey: process.env.AI_API_KEY || "sk-92234d58ac30fd89-ek8z31-71e3c791",
  // 9Router Proxy menolak default User-Agent OpenAI SDK (WAF block 403),
  // sehingga dipaksa memakai User-Agent umum agar request lolos.
  defaultHeaders: {
    "User-Agent": "Mozilla/5.0 (compatible; HarvestOS-Backend/1.0)",
    "X-API-Key": process.env.AI_API_KEY || "sk-92234d58ac30fd89-ek8z31-71e3c791",
  },
});

const DEFAULT_MODEL = process.env.AI_MODEL_NAME || "HarvestOS";

/**
 * Generate respon teks biasa dari model HarvestOS
 */
export async function generateAiResponse(prompt: string, systemPrompt?: string): Promise<string> {
  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || "Gagal menerima respon dari AI.";
  } catch (error: any) {
    console.error("❌ [9Router AI Error]:", error?.message || error);
    throw new Error(`AI Engine Error: ${error?.message || "Unknown error"}`);
  }
}

/**
 * Generate respon JSON terstruktur dari model HarvestOS
 */
export async function generateAiJson<T>(prompt: string, systemPrompt?: string): Promise<T> {
  try {
    const defaultSystem = systemPrompt
      ? `${systemPrompt}\nBALASAN HARUS BERUPA JSON VALID TANPA MARKDOWN FORMATTING.`
      : "Anda adalah asisten AI. Kembalikan jawaban HANYA dalam bentuk JSON valid tanpa markdown formatting.";

    const responseText = await generateAiResponse(prompt, defaultSystem);

    // Pembersihan tag markdown ```json ... ``` jika dikembalikan oleh AI
    const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson) as T;
  } catch (error) {
    console.error("❌ Failed to parse AI JSON:", error);
    throw new Error("Respon dari AI tidak dapat di-parse sebagai JSON valid.");
  }
}

export interface MultiSourcePriceResult {
  commodity: string;
  region: string;
  farmerPrice: number;
  hapPrice: number;
  trend: "UP" | "DOWN" | "STABLE";
  scrapedSources: string[];
  notes: string;
}

/**
 * Deep Multi-Source Realtime Price Scraper (Model HarvestOS / 9Router Proxy)
 * Mengumpulkan acuan harga pangan real-time HARI INI & JAM INI (WIB) dari berbagai sumber resmi.
 */
export async function fetchRealtimeMultiSourcePrice(
  commodity: string,
  region: string
): Promise<MultiSourcePriceResult> {
  const currentTimestamp = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "medium",
  });

  const prompt = `Lakukan penelusuran dan analisis estimasi harga pasar real-time pada HARI INI dan JAM INI (${currentTimestamp} WIB) untuk komoditas "${commodity}" khusus di wilayah "${region}".`;

  const systemPrompt = `Anda adalah Engine Analisis & Scraper Harga Pangan Real-Time Bapanas & Pasar Daerah Indonesia.
Tugas Anda adalah mengumpulkan, membandingkan, dan mengagregasikan data harga acuan tingkat petani (Farmer Price) serta Harga Acuan Pemerintah (HAP) dari BERBAGAI SUMBER TERPERCAYA, meliputi:
1. Panel Harga Badan Pangan Nasional (Bapanas)
2. Pusat Informasi Harga Pangan Strategis (PIHPS) Bank Indonesia
3. Portal Dinas Perindustrian dan Perdagangan / Dinas Pertanian Daerah (${region})
4. Informan Transaksi Pasar Induk & Gapoktan Setempat

Aturan Output:
- Ekstrak harga acuan terkini per Kilogram (Rupiah murni angka tanpa titik/koma).
- WAKTU EKSEKUSI DATA: ${currentTimestamp} WIB.
- Kembalikan BALASAN MURNI DALAM FORMAT JSON VALID TANPA MARKDOWN (tanpa \`\`\`json):
{
  "commodity": "${commodity}",
  "region": "${region}",
  "farmerPrice": number (harga rupiah per kg di tingkat petani),
  "hapPrice": number (harga acuan pemerintah/HAP konsumen),
  "trend": "UP" | "DOWN" | "STABLE",
  "scrapedSources": ["Panel Harga Bapanas", "PIHPS BI", "Dinas Pasar ${region}"],
  "notes": "Rangkuman tren singkat max 1 kalimat"
}`;

  return await generateAiJson<MultiSourcePriceResult>(prompt, systemPrompt);
}
