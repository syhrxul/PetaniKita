import QRCode from "qrcode";
import { Boom } from "@hapi/boom";
import { getSocket } from "./whatsapp.service";
import { formatToWaJid } from "../utils/phoneSanitizer";

export const waEngineState = {
  status: "OFFLINE" as "OFFLINE" | "CONNECTING" | "CONNECTED",
  qrCodeBase64: "",
  sendDelaySeconds: 2,
  enableTypingEffect: true,
  botPhone: "",
};

export const waLogsStore: Array<{
  id: string;
  recipientPhone: string;
  messageType: "BROADCAST" | "NOTIFICATION" | "SYSTEM";
  contentSnippet: string;
  status: "SENT" | "FAILED" | "QUEUED";
  timestamp: Date;
}> = [];

export function handleWaConnectionUpdate(update: any) {
  const { connection, qr, lastDisconnect } = update;

  if (qr) {
    QRCode.toDataURL(qr, { errorCorrectionLevel: 'M', margin: 2 }, (err, url) => {
      if (!err && url) {
        waEngineState.qrCodeBase64 = url;
        waEngineState.status = 'CONNECTING';
        console.log("📸 [WA BOT] QR Code berhasil di-generate ke Base64!");
      } else {
        console.error("❌ [WA BOT] Gagal generate QR ke Base64:", err?.message || err);
      }
    });
  }

  switch (connection) {
    case 'open':
      waEngineState.status = 'CONNECTED';
      waEngineState.qrCodeBase64 = '';
      console.log("✅ [WA BOT] Terhubung! QR Code disembunyikan.");
      break;
    case 'close':
      waEngineState.status = 'OFFLINE';
      waEngineState.qrCodeBase64 = '';
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
      console.log(`[WA BOT] Koneksi tertutup. reason=${reason ?? 'unknown'} → status OFFLINE`);
      break;
    case 'connecting':
      waEngineState.status = 'CONNECTING';
      break;
    case undefined:
      break;
  }
}

export async function sendHumanLikeWaMessage(
  sock: any,
  rawPhoneOrJid: string,
  text: string,
  type: "BROADCAST" | "NOTIFICATION" | "SYSTEM" = "NOTIFICATION"
): Promise<boolean> {
  const targetJid = rawPhoneOrJid.includes("@s.whatsapp.net")
    ? rawPhoneOrJid.trim()
    : formatToWaJid(rawPhoneOrJid);

  const cleanPhone = targetJid ? targetJid.replace("@s.whatsapp.net", "") : rawPhoneOrJid;

  const logEntry = {
    id: Math.random().toString(36).substring(7),
    recipientPhone: cleanPhone,
    messageType: type,
    contentSnippet: text.length > 60 ? text.substring(0, 60) + "..." : text,
    status: "FAILED" as "SENT" | "FAILED" | "QUEUED",
    timestamp: new Date(),
  };

  try {
    if (!sock || typeof sock.sendMessage !== "function" || waEngineState.status !== "CONNECTED") {
      console.warn(`[WA OFFLINE] Pesan ${type} ke ${cleanPhone} dilewati. Backend stabil.`);
      waLogsStore.unshift(logEntry);
      return false;
    }

    if (!targetJid) {
      waLogsStore.unshift(logEntry);
      return false;
    }

    if (waEngineState.sendDelaySeconds > 0) {
      await new Promise((res) => setTimeout(res, waEngineState.sendDelaySeconds * 1000));
    }

    if (waEngineState.enableTypingEffect) {
      try {
        await sock.sendPresenceUpdate("composing", targetJid);
        await new Promise((res) => setTimeout(res, 600));
        await sock.sendPresenceUpdate("paused", targetJid);
      } catch {
        // ignore
      }
    }

    await sock.sendMessage(targetJid, { text });
    logEntry.status = "SENT";
    waLogsStore.unshift(logEntry);
    console.log(`✅ [WA LOG] Pesan ${type} terkirim ke ${cleanPhone}`);
    return true;
  } catch (err: any) {
    console.error(`❌ [WA ERROR] Gagal kirim ${type} ke ${cleanPhone}:`, err?.message || err);
    waLogsStore.unshift(logEntry);
    return false;
  }
}

export async function notifyFarmerOnNewOrder(
  sock: any,
  farmerPhone: string,
  farmerName: string,
  commodity: string,
  qtyKg: number
) {
  const message =
    `🌾 *PESANAN BARU MASUK (PETANIKITA)* 🌾\n\n` +
    `Halo Pak/Bu *${farmerName}*,\n` +
    `UMKM memesan hasil panen Anda (*${commodity}*) sebanyak *${qtyKg} Kg*!\n\n` +
    `📌 Mohon konfirmasi: *ACC* atau *TOLAK#Alasan*`;

  return sendHumanLikeWaMessage(sock, farmerPhone, message, "NOTIFICATION");
}

export async function notifyUmkmOnOrderConfirmation(
  sock: any,
  umkmPhone: string,
  umkmName: string,
  commodity: string,
  qtyKg: number,
  totalPrice: number
) {
  const formattedPrice = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(totalPrice);

  const message =
    `🎉 *PESANAN DISETUJUI PETANI!* 🎉\n\n` +
    `Halo ${umkmName},\n` +
    `Pesanan *${commodity}* (${qtyKg} Kg) disetujui.\n` +
    `Total: *${formattedPrice}*\n\n` +
    `Petani akan segera mengantar/menyiapkan stok.`;

  return sendHumanLikeWaMessage(sock, umkmPhone, message, "NOTIFICATION");
}

export async function notifyUmkmOnOrderRejection(
  sock: any,
  umkmPhone: string,
  umkmName: string,
  commodity: string,
  reason: string
) {
  const message =
    `❌ *PESANAN DITOLAK PETANI*\n\n` +
    `Mohon maaf ${umkmName},\n` +
    `Pesanan *${commodity}* ditolak.\n\n` +
    `💬 Alasan: "${reason}"\n\n` +
    `Silakan pilih petani lain di Web PetaniKita.`;

  return sendHumanLikeWaMessage(sock, umkmPhone, message, "NOTIFICATION");
}

export async function sendHumanLikeMessageToPhone(phone: string, message: string) {
  const sock = getSocket();
  if (!sock) {
    console.warn("[WA OFFLINE] Socket tidak tersedia.");
    return false;
  }
  return sendHumanLikeWaMessage(sock, phone, message, "SYSTEM");
}
