// Shared LID → phone number mapping
// Diisi oleh contacts.upsert event, dibaca oleh handler
export const lidToPhone = new Map<string, string>();

export function registerLidMapping(lid: string, phone: string) {
  lidToPhone.set(lid, phone);
}
