import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  BaileysEventMap,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import fs from "fs";
import path from "path";
import { registerLidMapping } from "../lib/lid-map.js";
import { handleIncomingWaMessages } from "./waBotHandler.js";
import { handleWaConnectionUpdate, waEngineState } from "./whatsappBot.service.js";

const AUTH_FOLDER = path.resolve(process.cwd(), "auth_info_baileys");

const silentLogger = {
  level: "silent",
  child: () => silentLogger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

export type WaConnectionStatus = "DISCONNECTED" | "SCAN_QR_REQUIRED" | "CONNECTED";

let sock: WASocket | null = null;
let isManualReset = false;
const messageListeners: Array<(sock: WASocket, events: BaileysEventMap["messages.upsert"]) => void> = [];

export function onMessage(
  cb: (sock: WASocket, events: BaileysEventMap["messages.upsert"]) => void
) {
  messageListeners.push(cb);
}

export function stopWhatsAppService() {
  isManualReset = true;
  try {
    sock?.end(undefined);
  } catch (err: any) {
    console.warn("[WA] Gagal menutup socket lama:", err?.message || err);
  }
  sock = null;
  console.log("[WA] Socket lama ditutup. Auto-reconnect ditekan.");
}

export async function startWhatsAppService(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["HarvestOS", "Safari", "macOS"],
    logger: silentLogger,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("contacts.upsert", (contacts) => {
    for (const c of contacts) {
      if (c.lid && c.id) {
        const lidId = c.lid.replace("@lid", "").split(":")[0];
        const raw = c.id.replace("@s.whatsapp.net", "").split(":")[0];
        const phone = raw.startsWith("62") ? "0" + raw.slice(2) : raw;
        registerLidMapping(lidId, phone);
        registerLidMapping(c.lid, phone);
      }
    }
  });

  sock.ev.on("connection.update", async (update) => {
    // Handle QR code and connection state
    handleWaConnectionUpdate(update);

    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;

      // Sesi lama tidak valid (403 Forbidden / bad session): hapus sesi supaya bisa scan QR baru dari awal.
      // Ini mencegah loop tak berujung dengan sesi basi yang ditolak server.
      if (reason === 403) {
        console.log("[WA] Sesi lama ditolak server (403). Menghapus sesi & minta QR baru...");
        try {
          if (fs.existsSync(AUTH_FOLDER)) {
            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
            console.log("[WA] Sesi lama berhasil dihapus. Scan QR baru untuk connect dari awal.");
          }
        } catch (err: any) {
          console.warn("[WA] Gagal menghapus sesi:", err?.message || err);
        }
        waEngineState.status = "OFFLINE";
        waEngineState.qrCodeBase64 = "";
        waEngineState.botPhone = "";
        setTimeout(() => startWhatsAppService(), 1500);
      } else if (reason !== DisconnectReason.loggedOut && !isManualReset) {
        console.log(`[WA] Koneksi terputus (reason=${reason}). Reconnect: true`);
        setTimeout(() => startWhatsAppService(), 3000);
      } else {
        waEngineState.status = "OFFLINE";
        waEngineState.qrCodeBase64 = "";
        isManualReset = false;
        console.log("[WA] Tidak auto-reconnect (sesi di-reset / logout). Silakan scan QR baru.");
      }
    }

    if (connection === "open") {
      waEngineState.status = "CONNECTED";
      waEngineState.botPhone = sock?.user?.id || "";
      waEngineState.qrCodeBase64 = "";
      console.log("\n✓ WhatsApp Terminal Connected Successfully!");
    }
  });

  sock.ev.on("messages.upsert", (events) => {
    handleIncomingWaMessages(sock!, events);
    for (const listener of messageListeners) {
      listener(sock!, events);
    }
  });

  return sock;
}

export function getSocket(): WASocket | null {
  return sock;
}

export function isWaConnected(): boolean {
  return sock !== null && waEngineState.status === "CONNECTED";
}

export function getWaBotStatus() {
  return {
    connected: waEngineState.status === "CONNECTED",
    status: waEngineState.status,
    qrCodeBase64: waEngineState.qrCodeBase64,
    botPhone: waEngineState.botPhone,
    config: {
      sendDelaySeconds: waEngineState.sendDelaySeconds,
      enableTypingEffect: waEngineState.enableTypingEffect,
    },
  };
}
