import { parseIndonesianDateText } from "../utils/dateParser.js";

export interface ParsedHarvestData {
  isHarvestInput: boolean;
  commodityName?: string;
  quantityKg?: number;
  pricePerKg?: number;
  harvestDate?: Date;
  deliveryReadyDate?: Date;
  scheduleLabel?: string;
  confidence?: "AI" | "REGEX";
}

const DAY_NAMES = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

function atMorning(d: Date): Date {
  const x = new Date(d);
  x.setHours(7, 0, 0, 0);
  return x;
}

/**
 * Deteksi tanggal dari pesan petani.
 * Support: tanggal spesifik ("11 agustus"), relatif ("besok/lusa/hari ini"), nama hari.
 */
export function detectSchedule(lowerText: string): {
  harvestDate: Date;
  deliveryReadyDate: Date;
  scheduleLabel: string;
} {
  const now = new Date();
  let harvestDate = new Date(now);
  let deliveryReadyDate = new Date(now);
  let label = "Hari ini";

  // 1. Cari tanggal spesifik untuk panen: "siap panen tanggal X" atau "panen tanggal X"
  const harvestPhraseMatch = lowerText.match(
    /(?:siap\s+)?panen\s+(?:tanggal\s+)?(\d{1,2}\s+[a-z]+|\d{1,2}(?:\s+[a-z]+)?|besok|lusa|hari ini)/i
  );

  if (harvestPhraseMatch) {
    harvestDate = parseIndonesianDateText(harvestPhraseMatch[1], now);
    label = `${harvestDate.getDate()} ${["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][harvestDate.getMonth()]} ${harvestDate.getFullYear()}`;
  } else {
    // Fallback: cek kata kunci relatif
    const inDays = lowerText.match(/(\d+)\s*hari\s*(lagi|kedepan|ke depan|mendatang)/);
    const weekAhead = /minggu\s*depan|pekan\s*depan/.test(lowerText);
    const dayNameMatch = lowerText.match(/\bhari\s+(minggu|senin|selasa|rabu|kamis|jumat|jum'at|sabtu)\b/);

    if (/\blusa\b/.test(lowerText)) {
      harvestDate = parseIndonesianDateText("lusa", now);
      label = "Lusa";
    } else if (/\bbesok\b/.test(lowerText)) {
      harvestDate = parseIndonesianDateText("besok", now);
      label = "Besok";
    } else if (inDays) {
      const offsetDays = Math.min(parseInt(inDays[1], 10), 60);
      harvestDate = new Date(now);
      harvestDate.setDate(now.getDate() + offsetDays);
      label = `${offsetDays} hari lagi`;
    } else if (weekAhead) {
      harvestDate = new Date(now);
      harvestDate.setDate(now.getDate() + 7);
      label = "Minggu depan";
    } else if (dayNameMatch) {
      const target = DAY_NAMES.indexOf(dayNameMatch[1].replace("jum'at", "jumat"));
      if (target >= 0) {
        const diff = (target - now.getDay() + 7) % 7 || 7;
        harvestDate = new Date(now);
        harvestDate.setDate(now.getDate() + diff);
        label = `Hari ${dayNameMatch[1]}`;
      }
    }
  }

  // 2. Cari tanggal spesifik untuk antar: "siap antar tanggal Y" / "antar tanggal Y" / "ready tanggal Y"
  const deliveryPhraseMatch = lowerText.match(
    /(?:siap\s+)?(?:antar|kirim|ready|diambil)\s+(?:tanggal\s+)?(\d{1,2}\s+[a-z]+|\d{1,2}(?:\s+[a-z]+)?|besok|lusa|hari ini)/i
  );

  if (deliveryPhraseMatch) {
    deliveryReadyDate = parseIndonesianDateText(deliveryPhraseMatch[1], now);
  } else {
    // Default: sama dengan tanggal panen
    deliveryReadyDate = new Date(harvestDate);
  }

  return {
    harvestDate: atMorning(harvestDate),
    deliveryReadyDate: atMorning(deliveryReadyDate),
    scheduleLabel: label,
  };
}

const AI_ENDPOINT = process.env.AI_PARSER_URL || "https://9router.syhrulimtkhan.my.id/v1/chat/completions";
const AI_API_KEY = process.env.AI_PARSER_KEY || "sk-92234d58ac30fd89-ek8z31-71e3c791";
const AI_MODEL = process.env.AI_PARSER_MODEL || "HarvestOS";

const COMMODITY_ALIASES: Array<{ keywords: string[]; name: string }> = [
  { keywords: ["cabai rawit", "cabe rawit", "rawit"], name: "Cabai Rawit Merah" },
  { keywords: ["cabai merah keriting", "cabe keriting", "keriting"], name: "Cabai Merah Keriting" },
  { keywords: ["cabai", "cabe", "lombok"], name: "Cabai Rawit Merah" },
  { keywords: ["bawang merah", "brambang"], name: "Bawang Merah" },
  { keywords: ["bawang putih"], name: "Bawang Putih" },
  { keywords: ["tomat"], name: "Tomat Segar" },
  { keywords: ["kentang"], name: "Kentang" },
  { keywords: ["wortel"], name: "Wortel" },
  { keywords: ["kol", "kubis"], name: "Kubis" },
  { keywords: ["terong", "terung"], name: "Terong" },
  { keywords: ["jagung"], name: "Jagung" },
  { keywords: ["beras", "gabah", "padi"], name: "Beras" },
];

function detectCommodity(lowerText: string): string | undefined {
  for (const entry of COMMODITY_ALIASES) {
    if (entry.keywords.some(k => lowerText.includes(k))) return entry.name;
  }
  return undefined;
}

function toNumber(raw: string): number {
  return parseFloat(raw.replace(/\.(?=\d{3}\b)/g, "").replace(/\.$/, "").replace(",", "."));
}

/**
 * Normalisasi angka bersuffix ribuan: "28rb" / "28 ribu" / "28k" -> 28000
 */
function normalizePrice(value: number, suffix?: string): number {
  if (suffix) return Math.round(value * 1000);
  if (value > 0 && value < 1000) return Math.round(value * 1000);
  return Math.round(value);
}

/**
 * Ekstraksi berbasis Regex (fallback super cepat & offline-safe)
 */
export function parseFarmerMessageWithRegex(messageText: string): ParsedHarvestData {
  const lowerText = messageText.toLowerCase();

  const kgMatch = lowerText.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilo(?:gram)?|kwintal|kuintal|ton)\b/);
  if (!kgMatch) return { isHarvestInput: false };

  let quantityKg = toNumber(kgMatch[1]);
  const unit = kgMatch[2];
  if (unit.startsWith("k") && (unit.includes("uintal") || unit.includes("wintal"))) quantityKg *= 100;
  else if (unit === "ton") quantityKg *= 1000;

  const commodityName = detectCommodity(lowerText);
  if (!commodityName || !Number.isFinite(quantityKg) || quantityKg <= 0) {
    return { isHarvestInput: false };
  }

  // Cari harga: prioritaskan angka yang didahului kata kunci harga / rp
  let pricePerKg: number | undefined;
  const explicit = lowerText.match(
    /(?:harga|rp|seharga|dihargai|per\s*kg|perkilo)\D{0,12}(\d+(?:[.,]\d+)?)\s*(rb|ribu|k)?/
  );
  if (explicit) {
    pricePerKg = normalizePrice(toNumber(explicit[1]), explicit[2]);
  } else {
    // Ambil angka lain di luar rentang kuantitas
    const kgIndex = kgMatch.index ?? 0;
    const tail = lowerText.slice(kgIndex + kgMatch[0].length);
    const tailNum = tail.match(/(\d+(?:[.,]\d+)?)\s*(rb|ribu|k)?/);
    if (tailNum) pricePerKg = normalizePrice(toNumber(tailNum[1]), tailNum[2]);
  }

  const schedule = detectSchedule(lowerText);

  return {
    isHarvestInput: true,
    commodityName,
    quantityKg,
    pricePerKg,
    harvestDate: schedule.harvestDate,
    deliveryReadyDate: schedule.deliveryReadyDate,
    scheduleLabel: schedule.scheduleLabel,
    confidence: "REGEX",
  };
}

/**
 * Membaca pesan alami Petani menggunakan AI NLP, dengan fallback Regex.
 */
export async function parseFarmerMessageWithAI(messageText: string): Promise<ParsedHarvestData> {
  const regexResult = parseFarmerMessageWithRegex(messageText);

  // Fast-path: regex sudah menangkap komoditas + kuantitas + harga -> balas instan tanpa panggil AI
  if (regexResult.isHarvestInput && regexResult.pricePerKg) {
    return regexResult;
  }

  // Pesan pendek berupa menu angka / sapaan -> tidak perlu AI
  if (messageText.trim().length < 8) {
    return regexResult;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "You are an entity extraction API for Indonesian farmer messages. Output RAW JSON only, no markdown.",
          },
          {
            role: "user",
            content:
              `Ekstrak data panen dari pesan petani berikut. Balas HANYA JSON: ` +
              `{"isHarvestInput":boolean,"commodityName":string|null,"quantityKg":number|null,"pricePerKg":number|null}. ` +
              `Aturan: isHarvestInput true hanya jika pesan menyebut komoditas pertanian DAN jumlah panen. ` +
              `Normalisasi harga: "28rb"/"28 ribu" = 28000. Konversi kuintal=100kg, ton=1000kg. ` +
              `commodityName pakai Title Case bahasa Indonesia.\n\nPesan: "${messageText}"`,
          },
        ],
      }),
    });

    clearTimeout(timeout);

    const data = (await res.json()) as any;
    let content: string = data?.choices?.[0]?.message?.content?.trim() || "";
    if (content.startsWith("```")) {
      content = content.replace(/```json/gi, "").replace(/```/g, "").trim();
    }

    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON in AI response");

    const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
    const aiSchedule = detectSchedule(messageText.toLowerCase());
    const quantityKg = Number(parsed.quantityKg);
    const pricePerKg = Number(parsed.pricePerKg);

    if (parsed.isHarvestInput && parsed.commodityName && Number.isFinite(quantityKg) && quantityKg > 0) {
      return {
        isHarvestInput: true,
        commodityName: String(parsed.commodityName),
        quantityKg,
        pricePerKg: Number.isFinite(pricePerKg) && pricePerKg > 0 ? pricePerKg : regexResult.pricePerKg,
        harvestDate: aiSchedule.harvestDate,
        deliveryReadyDate: aiSchedule.deliveryReadyDate,
        scheduleLabel: aiSchedule.scheduleLabel,
        confidence: "AI",
      };
    }

    // AI bilang bukan input panen, tapi regex yakin -> percaya regex
    return regexResult.isHarvestInput ? regexResult : { isHarvestInput: false };
  } catch (error) {
    console.error(
      "[AI PARSER] Fallback ke regex:",
      error instanceof Error ? error.message : error
    );
    return regexResult;
  }
}
