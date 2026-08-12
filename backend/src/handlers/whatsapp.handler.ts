import { WASocket } from "@whiskeysockets/baileys";
import { BaileysEventMap } from "@whiskeysockets/baileys";
import { prisma } from "../lib/prisma.js";

const FORM_BASE_URL = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Sementara simpan state: JID yang sedang diminta nomornya
const awaitingPhone = new Set<string>();

function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("62") && digits.length >= 10) return "0" + digits.slice(2);
  if (digits.startsWith("08") && digits.length >= 10) return digits;
  if (digits.startsWith("8") && digits.length >= 9) return "0" + digits;
  return null;
}

export async function handleIncomingMessages(
  sock: WASocket,
  { messages, type }: BaileysEventMap["messages.upsert"]
) {
  if (type !== "notify") return;

  for (const msg of messages) {
    if (msg.key.fromMe) continue;

    const jid = msg.key.remoteJid;
    if (!jid || jid.endsWith("@g.us") || jid.endsWith("@broadcast")) continue;

    const messageText =
      msg.message?.conversation ??
      msg.message?.extendedTextMessage?.text ??
      "";

    if (!messageText) continue;

    // State: sedang menunggu nomor HP dari JID ini
    if (awaitingPhone.has(jid)) {
      const phone = normalizePhone(messageText);

      if (!phone) {
        await sock.sendMessage(jid, {
          text: "Format nomor tidak valid. Contoh: 08123456789 atau 628123456789",
        });
        continue;
      }

      awaitingPhone.delete(jid);

      await prisma.whatsappJob.create({
        data: {
          sender_phone: phone,
          message_payload: "[nomor dikonfirmasi via WA]",
          status: "PENDING",
        },
      });

      console.log(`[WA] Nomor terkonfirmasi: ${phone} dari ${jid}`);

      await sock.sendMessage(jid, {
        text:
          `Terima kasih! Nomor Anda (${phone}) sudah tercatat.\n\n` +
          `Silakan klik link berikut untuk menginput data panen:\n` +
          `${FORM_BASE_URL}/p/form?phone=${phone}`,
      });

      continue;
    }

    // Pesan pertama → simpan log & minta nomor HP
    console.log(`[WA] Pesan masuk dari ${jid}: ${messageText}`);

    await prisma.whatsappJob.create({
      data: {
        sender_phone: jid,
        message_payload: messageText,
        status: "PENDING",
      },
    });

    awaitingPhone.add(jid);

    await sock.sendMessage(jid, {
      text:
        "Halo Pak/Bu! Selamat datang di *PetaniKita* 🌾\n\n" +
        "Untuk melanjutkan, mohon balas pesan ini dengan *nomor WhatsApp Anda*.\n" +
        "Contoh: 08123456789",
    });

    console.log(`[WA] Meminta nomor HP dari ${jid}`);
  }
}
