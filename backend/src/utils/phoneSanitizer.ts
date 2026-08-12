/**
 * Membersihkan dan memformat nomor HP murni angka berawalan 62.
 * Contoh: "+62 812-3456-7890" -> "6281234567890"
 * Contoh: "081234567890"      -> "6281234567890"
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone) return "";

  // 1. Hapus semua karakter yang bukan angka
  let cleaned = phone.replace(/\D/g, "");

  // 2. Jika berawalan '0', ganti dengan '62'
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.substring(1);
  }

  return cleaned;
}

/**
 * Mengubah format nomor telepon lokal (08xxx) menjadi format 628xxx
 * @deprecated Gunakan sanitizePhoneNumber()
 */
export function sanitizePhoneTo62(phone: string): string {
  return sanitizePhoneNumber(phone);
}

/**
 * Mengubah nomor menjadi Baileys WhatsApp JID yang valid
 */
export function formatToWaJid(phone: string): string {
  const sanitized = sanitizePhoneNumber(phone);
  return `${sanitized}@s.whatsapp.net`;
}

/**
 * Validasi Format Username (Hanya Huruf & Angka, Tanpa Spasi)
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9]+$/;
  return usernameRegex.test(username);
}
