const MONTH_MAP: Record<string, number> = {
  januari: 0, jan: 0,
  februari: 1, feb: 1,
  maret: 2, mar: 2,
  april: 3, apr: 3,
  mei: 4,
  juni: 5, jun: 5,
  juli: 6, jul: 6,
  agustus: 7, agu: 7, ags: 7,
  september: 8, sep: 8,
  oktober: 9, okt: 9,
  november: 10, nov: 10,
  desember: 11, des: 11,
};

/**
 * Parse tanggal dalam bahasa Indonesia dari teks bebas.
 * Contoh: "11 agustus", "11 agustus 2026", "besok", "lusa", "hari ini"
 */
export function parseIndonesianDateText(text: string, referenceDate: Date = new Date()): Date {
  const lower = text.toLowerCase().trim();
  const result = new Date(referenceDate);

  // Hari ini
  if (lower.includes("hari ini")) return result;

  // Besok
  if (lower.includes("besok")) {
    result.setDate(result.getDate() + 1);
    return result;
  }

  // Lusa
  if (lower.includes("lusa")) {
    result.setDate(result.getDate() + 2);
    return result;
  }

  // Regex: "11 agustus" atau "11 agustus 2026"
  const datePattern = /(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/i;
  const match = lower.match(datePattern);

  if (match) {
    const day = parseInt(match[1], 10);
    const monthName = match[2].toLowerCase();
    const year = match[3] ? parseInt(match[3], 10) : referenceDate.getFullYear();

    if (MONTH_MAP[monthName] !== undefined) {
      return new Date(year, MONTH_MAP[monthName], day, 10, 0, 0);
    }
  }

  // Fallback: "tanggal 13" (hanya angka hari)
  const numOnly = lower.match(/(?:tanggal\s+)?(\d{1,2})\s*$/i) || lower.match(/(\d{1,2})\s*(?:ags|agustus|september|okt|nov|des)/i);
  if (numOnly) {
    const day = parseInt(numOnly[1], 10);
    if (day >= 1 && day <= 31) {
      // Jika hari lebih kecil dari hari ini, berarti bulan depan
      if (day < referenceDate.getDate()) {
        result.setMonth(result.getMonth() + 1);
      }
      result.setDate(day);
      return result;
    }
  }

  return result;
}

/**
 * Format tanggal ke string Indonesia (contoh: "11 Agustus 2026")
 */
export function formatIndonesianDate(date: Date): string {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Format tanggal pendek (contoh: "11 Agu 2026")
 */
export function formatShortDate(date: Date): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}
