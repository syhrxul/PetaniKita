import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys";
import path from "path";

const { state, saveCreds } = await useMultiFileAuthState(
  path.resolve(process.cwd(), "auth_info_baileys")
);

const sock = makeWASocket({ auth: state, printQRInTerminal: false });
sock.ev.on("creds.update", saveCreds);

sock.ev.on("connection.update", ({ connection }) => {
  if (connection === "open") console.log("ready — kirim pesan WA sekarang");
});

sock.ev.on("messages.upsert", ({ messages, type }) => {
  if (type !== "notify") return;
  for (const msg of messages) {
    if (msg.key.fromMe) continue;
    console.log("=== RAW MSG ===");
    console.log("key:", JSON.stringify(msg.key));
    console.log("pushName:", msg.pushName);
    console.log("lid (from key):", (msg.key as any).lid);
    console.log("participant:", msg.key.participant);
    console.log("msg top-level keys:", Object.keys(msg));
  }
});
