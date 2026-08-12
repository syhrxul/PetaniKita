import { startWhatsAppService, onMessage } from "../services/whatsapp.service";
import { handleIncomingMessages } from "../handlers/whatsapp.handler";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("=== PetaniKita WhatsApp Terminal Bot ===");
  console.log("[INFO] Memulai service...\n");

  // Daftarkan handler pesan
  onMessage(handleIncomingMessages);

  // Start service → akan print QR jika belum auth
  await startWhatsAppService();

  // Keep alive — proses tidak exit agar bot tetap berjalan
  process.on("SIGINT", async () => {
    console.log("\n[INFO] Shutdown...");
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("[FATAL]", e.message);
  process.exit(1);
});
