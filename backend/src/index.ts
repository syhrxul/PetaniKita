import express, { Request, Response } from "express";
import cors from "cors";
import cron from "node-cron";
import bcrypt from "bcrypt";
import { prisma, withRetry } from "./lib/prisma.js";
import { resolveRegionName } from "./utils/geocoding.js";
import { ensureRegionPriceExists, run12HourBatchCron } from "./services/price_discovery.service.js";
import { initPriceScraperCron } from "./services/cronPriceScraper.service.js";
import { fetchPricesFromAI } from "./utils/pythonLauncher.js";
import { fetchAllRegisteredRegionalPrices, getRegisteredRegionsFromDb } from "./services/regionalPrice.service.js";
import { analyzePriceProposalAI } from "./services/price_decision_ai.service.js";
import { startWhatsAppService, getSocket, isWaConnected } from "./services/whatsapp.service.js";
import {
  sendHumanLikeWaMessage,
  notifyFarmerOnNewOrder,
  notifyUmkmOnOrderConfirmation,
  sendHumanLikeMessageToPhone,
} from "./services/whatsappBot.service.js";

import { httpLoggerMiddleware } from "./middlewares/requestLogger.middleware.js";
import { recordAuditLog, logActivity } from "./services/auditLog.service.js";
import {
  getRegionalPriceMonitoring,
  createUserByAdmin,
  toggleUserStatus,
  getAllOrders,
  getAdminStats,
  sendWaBroadcast,
  impersonateUser,
  getGeoRadar,
  getWaBotStatusEndpoint,
  getBroadcastProgress,
  getBroadcastJobsEndpoint,
} from "./controllers/admin.controller.js";
import {
  getAuditLogs,
  getUsersManagement,
  resetUserPassword,
  promoteUserRole,
  deleteUserAccount,
  getRegionalPricesAndCommodities,
  getGeospatialRadarData,
  getWaEngineStatus,
  updateWaSettings,
  getWaLogs,
} from "./controllers/superadmin.controller.js";
import {
  requestOtp,
  verifyOtp,
  registerWithOtp,
  registerDirect,
  checkUsername,
  checkPhone,
} from "./controllers/auth.controller.js";
import {
  scrapePriceEndpoint,
  scrapeBatchPricesEndpoint,
  getMultiRegionPrices,
  getPricesByRegion,
  ensurePriceEndpoint,
} from "./controllers/priceScraper.controller.js";
import { updateLocationFromWaToken, updateLocationAndPasswordFromWa } from "./controllers/location.controller.js";
import { updateOrderByUmkm } from "./controllers/orderEdit.controller.js";
import { createP2POrder, quoteP2POrder, respondToOrderByFarmer } from "./controllers/procurement.controller.js";
import { getFarmerNegotiations, respondToNegotiation } from "./controllers/farmerNegotiation.controller.js";
import { sanitizePhoneTo62, sanitizePhoneNumber, formatToWaJid } from "./utils/phoneSanitizer.js";
import superadminRouter from "./routes/superadmin.route.js";

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(express.json());
app.use(httpLoggerMiddleware);

// CORS Configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://xc4v9xjv-3000.asse.devtunnels.ms",
  "http://localhost:3000"
].filter(Boolean);

app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o as string))) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true
}));

// Mount superadmin router AFTER cors
app.use("/api/v1/superadmin", superadminRouter);

// Jadwalkan 12-Hour Batch Cron Job
cron.schedule("0 */12 * * *", () => {
  run12HourBatchCron();
});

// Jadwalkan Dynamic Multi-Source Realtime Price Scraper (00:00 & 12:00 WIB)
initPriceScraperCron();

// PROCUREMENT ENDPOINTS (REAL MARIADB + SPATIAL)
app.get("/api/v1/procurement/dashboard-stats", async (req: Request, res: Response) => {
  const umkmId = Number(req.query.umkmId ?? 2);

  try {
    const orders = await prisma.umkmOrder.findMany({
      where: { umkm_user_id: umkmId },
      include: { harvest_event: true },
    });

    const activeOrdersCount = orders.filter(
      o =>
        o.status === "PENDING_FARMER_CONFIRMATION" ||
        o.status === "WAITING_FARMER_NEGO_APPROVAL" ||
        o.status === "ACCEPTED"
    ).length;

    const totalKgThisWeek = orders.reduce((sum, o) => sum + (o.amount_kg || 0), 0);
    const totalSpentThisMonth = orders.reduce((sum, o) => sum + (o.grand_total ?? o.total_amount ?? 0), 0);
    const totalSaved = orders.reduce((sum, o) => sum + ((o.amount_kg || 0) * 5000), 0);

    const user = await prisma.user.findUnique({ where: { id: umkmId } });
    const createdAt = user?.created_at || new Date();
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 3600 * 24));

    const isAiReady = diffInDays >= 3 && orders.length >= 3;
    const daysRemaining = Math.max(0, 3 - diffInDays);

    res.json({
      success: true,
      data: {
        weeklyDemandKg: totalKgThisWeek || 0,
        activeEscrowOrders: activeOrdersCount || 0,
        totalCostSavings: totalSaved || 0,
        monthlyExpenses: totalSpentThisMonth || 0,
        totalKgThisWeek: totalKgThisWeek || 0,
        activeOrdersCount: activeOrdersCount || 0,
        totalSaved: totalSaved || 0,
        totalSpentThisMonth: totalSpentThisMonth || 0,
        aiStatus: {
          isReady: isAiReady,
          daysActive: diffInDays,
          daysRemaining: daysRemaining,
          totalTransactions: orders.length,
        },
      },
    });
  } catch (err: unknown) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ success: false, message: "Gagal memuat statistik." });
  }
});

app.get("/api/v1/procurement/recommendations", async (req: Request, res: Response) => {
  const umkmId = Number(req.query.umkmId ?? 2);

  try {
    const user = await prisma.user.findUnique({ where: { id: umkmId } });
    const ordersCount = await prisma.umkmOrder.count({ where: { umkm_user_id: umkmId } });

    const createdAt = user?.created_at || new Date();
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 3600 * 24));

    if (ordersCount < 3 || diffInDays < 3) {
      const starterKit = [
        { commodity: "cabai_rawit", commodityName: "Cabai Rawit Merah", requiredKg: 10, predictedKg: 10, deadline: "Paket Starter UMKM", priority: "Normal" },
        { commodity: "bawang_merah", commodityName: "Bawang Merah", requiredKg: 15, predictedKg: 15, deadline: "Paket Starter UMKM", priority: "Normal" },
        { commodity: "tomat", commodityName: "Tomat Segar", requiredKg: 5, predictedKg: 5, deadline: "Paket Starter UMKM", priority: "Normal" },
      ];
      return res.json({
        success: true,
        isColdStart: true,
        message: "Sistem AI sedang mempelajari pola konsumsi harian Anda.",
        data: starterKit,
        recommendations: starterKit,
      });
    }

    const realRecommendations = [
      { commodity: "cabai_rawit", commodityName: "Cabai Rawit Merah", requiredKg: 25.5, predictedKg: 25.5, deadline: "Kamis", priority: "Urgent" },
      { commodity: "bawang_merah", commodityName: "Bawang Merah", requiredKg: 30.0, predictedKg: 30.0, deadline: "Jumat", priority: "Urgent" },
      { commodity: "tomat", commodityName: "Tomat Segar", requiredKg: 12.0, predictedKg: 12.0, deadline: "Sabtu", priority: "Normal" },
    ];

    res.json({
      success: true,
      isColdStart: false,
      data: realRecommendations,
      recommendations: realRecommendations,
    });
  } catch (err: unknown) {
    console.error("Error fetching recommendations:", err);
    res.status(500).json({ success: false, message: "Gagal memuat rekomendasi." });
  }
});

app.get("/api/v1/procurement/suppliers", async (req: Request, res: Response) => {
  const umkmId = Number(req.query.umkmId ?? 2);

  try {
    const umkmUser = await prisma.user.findUnique({
      where: { id: umkmId },
    });

    const umkmLat = umkmUser?.latitude ?? -7.8014;
    const umkmLng = umkmUser?.longitude ?? 110.3644;

    const availableHarvests = await prisma.harvestEvent.findMany({
      where: { status: "AVAILABLE", est_yield_kg: { gt: 0 } },
      include: {
        crop: { include: { user: true } },
      },
      orderBy: { uploaded_at: "desc" },
    });

    const suppliersData = availableHarvests.map(h => {
      const fLat = h.crop.latitude;
      const fLng = h.crop.longitude;

      // Haversine / ST_Distance_Sphere formula
      const R = 6371.0;
      const dLat = (fLat - umkmLat) * Math.PI / 180;
      const dLng = (fLng - umkmLng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(umkmLat * Math.PI / 180) * Math.cos(fLat * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const distKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;

      return {
        harvestId: h.id,
        farmerName: h.crop.user.name,
        farmerPhone: h.crop.user.phone_number,
        regionName: h.crop.regionName || "Kabupaten Sleman",
        commodities: h.crop.crop_type,
        pricePerKg: h.price_per_kg ?? 28000,
        availableYieldKg: h.est_yield_kg,
        distanceKm: distKm,
        uploadedAt: h.uploaded_at,
        harvestDate: h.est_harvest_date,
        deliveryReadyDate: h.delivery_ready_date,
        expiryDate: h.expiry_date,
      };
    });

    res.json({
      success: true,
      data: suppliersData,
    });
  } catch (err: unknown) {
    res.status(500).json({ message: "Gagal mengambil daftar supplier terdekat" });
  }
});

// USER PROFILE ENDPOINTS
app.get("/api/v1/user/profile", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");
  const userIdStr = token.replace("mock_token_", "");
  const userId = Number(userIdStr);

  try {
    const user = await prisma.user.findUnique({
      where: { id: isNaN(userId) ? 2 : userId },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      id: user.id,
      name: user.name,
      username: user.name,
      phone_number: user.phone_number,
      role: user.role,
      business_type: user.business_type || "Warung Makan / Restoran",
      latitude: user.latitude,
      longitude: user.longitude,
      regionName: user.regionName || "Kabupaten Sleman",
    });
  } catch (err: unknown) {
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/v1/user/profile", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");
  const userIdStr = token.replace("mock_token_", "");
  const userId = Number(userIdStr);

  const { name, business_type, phone_number, latitude, longitude, regionName } = req.body;

  try {
    const lat = latitude !== undefined ? parseFloat(latitude) : -7.8014;
    const lng = longitude !== undefined ? parseFloat(longitude) : 110.3644;
    const finalRegion = regionName || (await resolveRegionName(lat, lng));

    const updatedUser = await prisma.user.update({
      where: { id: isNaN(userId) ? 2 : userId },
      data: {
        name,
        business_type,
        phone_number,
        latitude: lat,
        longitude: lng,
        regionName: finalRegion,
      },
    });

    res.json({ message: "✓ Profil Usaha berhasil diperbarui di MariaDB!", user: updatedUser });
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Gagal memperbarui profil" });
  }
});

// LEDGER ENDPOINTS (AUTOMATIC + MANUAL)
app.get("/api/v1/procurement/ledger/:userId", async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);

  try {
    const orders = await prisma.umkmOrder.findMany({
      where: { umkm_user_id: userId },
      include: { harvest_event: { include: { crop: true } } },
      orderBy: { created_at: "desc" },
    });

    const manualEntries = await prisma.manualLedgerEntry.findMany({
      where: { user_id: userId },
      orderBy: { entry_date: "desc" },
    });

    const autoList = orders.map(o => ({
      id: `AUTO-${o.id}`,
      dbId: o.id,
      date: o.created_at.toISOString().split("T")[0],
      item: o.harvest_event?.crop?.crop_type ?? "Pengadaan Pangan PetaniKita",
      category: "Bahan Pangan Utama",
      source: "PetaniKita_Auto",
      amountRp: o.total_amount,
      vendor: "Petani Terverifikasi",
    }));

    const manualList = manualEntries.map(m => ({
      id: `MANUAL-${m.id}`,
      dbId: m.id,
      date: m.entry_date.toISOString().split("T")[0],
      item: m.item_name,
      category: m.category,
      source: "Manual_Input",
      amountRp: m.amount_rp,
      vendor: m.vendor_name || "Vendor Lokal",
    }));

    const combined = [...autoList, ...manualList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalAuto = autoList.reduce((acc, curr) => acc + curr.amountRp, 0);
    const totalManual = manualList.reduce((acc, curr) => acc + curr.amountRp, 0);

    res.json({
      totalAmountRp: totalAuto + totalManual,
      totalAutoRp: totalAuto,
      totalManualRp: totalManual,
      entries: combined,
    });
  } catch (err: unknown) {
    res.status(500).json({ message: "Gagal mengambil data pembukuan kas" });
  }
});

app.post("/api/v1/procurement/ledger", async (req: Request, res: Response) => {
  const { user_id, item_name, category, amount_rp, vendor_name, entry_date } = req.body;
  try {
    const entry = await prisma.manualLedgerEntry.create({
      data: {
        user_id: user_id ?? 2,
        item_name,
        category: category || "Bahan Pangan Utama",
        amount_rp: parseFloat(amount_rp),
        vendor_name: vendor_name || "Vendor Lokal",
        entry_date: entry_date ? new Date(entry_date) : new Date(),
      },
    });
    res.json({ message: "✓ Pengeluaran manual berhasil dicatat!", entry });
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Gagal mencatat pengeluaran" });
  }
});

app.delete("/api/v1/procurement/ledger/:entryId", async (req: Request, res: Response) => {
  const entryId = Number(req.params.entryId);
  try {
    await prisma.manualLedgerEntry.delete({ where: { id: entryId } });
    res.json({ message: "✓ Catatan manual berhasil dihapus!" });
  } catch (err: unknown) {
    res.status(400).json({ message: "Gagal menghapus catatan" });
  }
});









// LOCATION UPDATE FROM WA SHARE LINK
app.post("/api/v1/location/update-from-wa", async (req: Request, res: Response) => {
  await updateLocationFromWaToken(req, res);
});

// ACTIVATE WA ACCOUNT: REVERSE GEOCODE + PASSWORD SETTING
app.post("/api/v1/location/activate-wa-account", async (req: Request, res: Response) => {
  await updateLocationAndPasswordFromWa(req, res);
});



// PRICE PROPOSAL & OVERRIDE
app.post("/api/v1/prices/propose", async (req: Request, res: Response) => {
  const { user_id, regionName, commodity, proposed_price, reason } = req.body;
  try {
    const proposal = await prisma.priceProposal.create({
      data: {
        user_id: user_id ?? 1,
        regionName: regionName || "Kabupaten Sleman",
        commodity,
        proposed_price: parseFloat(proposed_price),
        reason: reason || "",
        status: "PENDING",
      },
    });
    const proposer = await prisma.user.findUnique({ where: { id: proposal.user_id } });
    logActivity({
      userId: proposal.user_id,
      role: proposer?.role ?? "PETANI",
      actorPhone: proposer?.phone_number,
      actorName: proposer?.name ?? "Petani",
      action: "PRICE_PROPOSAL_SUBMITTED",
      module: "PRICE_ENGINE",
      description: `Petani "${proposer?.name ?? "-"}" mengajukan harga ${commodity} sebesar Rp ${Number(proposed_price).toLocaleString("id-ID")}/Kg di ${proposal.regionName}. Alasan: ${reason || "-"}.`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ id: proposal.id, message: "Pengajuan harga berhasil dikirim ke Superadmin" });
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Gagal mengirim pengajuan" });
  }
});

app.get("/api/v1/prices/proposals", async (req: Request, res: Response) => {
  try {
    const pending = await prisma.priceProposal.findMany({
      where: { status: "PENDING" },
      include: { user: true },
      orderBy: { created_at: "desc" },
    });

    if (pending.length === 0) {
      return res.json({ proposals: [], aiAnalysis: null });
    }

    const firstProp = pending[0];
    const sameRegionProps = pending.filter(
      p => p.regionName === firstProp.regionName && p.commodity === firstProp.commodity
    );
    const totalFarmers = sameRegionProps.length;
    const sumPrice = sameRegionProps.reduce((acc, curr) => acc + curr.proposed_price, 0);
    const avgProposedPrice = Math.round(sumPrice / totalFarmers);
    const reasons = sameRegionProps.map(p => p.reason).filter(Boolean) as string[];

    const currentRecord = await prisma.priceHistory.findUnique({
      where: {
        regionName_commodity: {
          regionName: firstProp.regionName,
          commodity: firstProp.commodity,
        },
      },
    });
    const currentPrice = currentRecord?.farmer_price ?? avgProposedPrice * 0.9;

    const aiAnalysis = await analyzePriceProposalAI(
      firstProp.regionName,
      firstProp.commodity,
      currentPrice,
      totalFarmers,
      avgProposedPrice,
      reasons
    );

    res.json({
      summary: {
        regionName: firstProp.regionName,
        commodity: firstProp.commodity,
        currentPrice,
        totalFarmers,
        avgProposedPrice,
        reasons,
      },
      proposals: pending,
      aiAnalysis,
    });
  } catch (err: unknown) {
    res.status(500).json({ message: "Gagal mengambil data pengajuan" });
  }
});

app.post("/api/v1/prices/override", async (req: Request, res: Response) => {
  const { regionName, commodity, overridePrice, isCustomLocked, lockUntil } = req.body;
  try {
    const newPrice = parseFloat(overridePrice);

    const currentRecord = await prisma.priceHistory.findUnique({
      where: { regionName_commodity: { regionName, commodity } },
    });

    const prevPrice = currentRecord?.farmer_price ?? newPrice;
    const trend = newPrice > prevPrice ? "UP" : newPrice < prevPrice ? "DOWN" : "STABLE";

    const updatedPrice = await prisma.priceHistory.upsert({
      where: { regionName_commodity: { regionName, commodity } },
      update: {
        farmer_price: newPrice,
        prev_price: prevPrice,
        umkm_price: Math.round(newPrice * 1.2),
        hap_price: Math.round(newPrice * 1.15),
        trend,
        isCustomLocked: Boolean(isCustomLocked),
        lockUntil: isCustomLocked && lockUntil ? new Date(lockUntil) : null,
        updated_at: new Date(),
      },
      create: {
        regionName,
        commodity,
        farmer_price: newPrice,
        prev_price: prevPrice,
        umkm_price: Math.round(newPrice * 1.2),
        hap_price: Math.round(newPrice * 1.15),
        trend,
        isCustomLocked: Boolean(isCustomLocked),
        lockUntil: isCustomLocked && lockUntil ? new Date(lockUntil) : null,
      },
    });

    await prisma.priceProposal.updateMany({
      where: { regionName, commodity, status: "PENDING" },
      data: { status: "APPROVED" },
    });

    logActivity({
      actorName: "Superadmin",
      role: "SUPERADMIN",
      action: "PRICE_OVERRIDE",
      module: "PRICE_ENGINE",
      description: `Superadmin meng-override harga ${commodity} di ${regionName}: Rp ${prevPrice.toLocaleString("id-ID")} → Rp ${newPrice.toLocaleString("id-ID")}/Kg (trend ${trend})${isCustomLocked ? ", harga dikunci" : ""}.`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      message: `Harga ${commodity} di ${regionName} berhasil diperbarui menjadi Rp ${newPrice.toLocaleString()}/kg`,
      updatedPrice,
    });
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Gagal meng-override harga" });
  }
});

// AUTH & OTHER ENDPOINTS
app.post("/api/auth/register", async (req: Request, res: Response) => {
  const { username, password, role, email, phone_number, phone, latitude, longitude, regionName, waLid } = req.body;
  try {
    const validRoles = ["PETANI", "UMKM", "SUPERADMIN"];
    const userRole = (role ?? "PETANI").toUpperCase();
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({ message: `Role "${role}" tidak diperbolehkan. Pilihan role: PETANI, UMKM, SUPERADMIN.` });
    }

    // Sanitasi nomor HP
    const rawPhone = phone_number || phone;
    const sanitizedPhone = sanitizePhoneNumber(rawPhone);

    if (!sanitizedPhone) {
      return res.status(400).json({ message: "Nomor HP wajib diisi!" });
    }

    // Validasi format username
    const cleanUsername = (username || "").trim();
    const usernameRegex = /^[a-zA-Z0-9]+$/;
    if (!usernameRegex.test(cleanUsername)) {
      return res.status(400).json({ message: "Username hanya boleh berisi huruf dan angka tanpa spasi!" });
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });
    if (existingUsername) {
      return res.status(400).json({ message: `Username "${cleanUsername}" sudah digunakan. Silakan gunakan username lain.` });
    }

    const existingPhone = await prisma.user.findUnique({
      where: { phone_number: sanitizedPhone },
    });
    if (existingPhone) {
      return res.status(400).json({ message: `No. WhatsApp "${sanitizedPhone}" sudah terdaftar. Silakan gunakan nomor lain atau masuk.` });
    }

    const lat = latitude ?? -7.7558;
    const lng = longitude ?? 110.4052;
    const finalRegion = regionName || (await resolveRegionName(lat, lng));
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        name: cleanUsername,
        phone_number: sanitizedPhone,
        role: userRole,
        password: hashedPassword,
        latitude: lat,
        longitude: lng,
        regionName: finalRegion,
      },
    });

    if (waLid) {
      try {
        await prisma.waRegistration.upsert({
          where: { waLid },
          update: {
            name: cleanUsername,
            phone: sanitizedPhone,
            role: userRole,
            isRegistered: true,
          },
          create: {
            waLid,
            name: cleanUsername,
            phone: sanitizedPhone,
            role: userRole,
            isRegistered: true,
          },
        });
        console.log(`[WA REGISTRATION] Account linked with WA LID: ${waLid}`);
      } catch (waRegErr) {
        console.error("[WA REGISTRATION] Error linking waLid:", waRegErr);
      }
    }

    ensureRegionPriceExists(finalRegion).catch(err => console.error("On-Demand Trigger error:", err));

    logActivity({
      userId: String(user.id),
      role: user.role,
      actorPhone: user.phone_number,
      actorName: user.name,
      action: waLid ? "USER_REGISTERED_WA" : "USER_REGISTERED_WEB",
      module: "AUTH",
      description: `Pengguna baru "${user.username}" (${user.role}) mendaftar di wilayah ${finalRegion}${waLid ? " melalui Bot WhatsApp" : " melalui Web"}. No HP: ${sanitizedPhone}.`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      token: `mock_token_${user.id}`,
      latitude: user.latitude,
      longitude: user.longitude,
      regionName: user.regionName,
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return res.status(400).json({ message: "Username atau No. WhatsApp sudah terdaftar." });
    }
    res.status(400).json({ message: err instanceof Error ? err.message : "Registration failed" });
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { identifier, password } = req.body;
  try {
    const user = await prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { name: identifier }, { phone_number: identifier }] },
    });
    if (!user) {
      logActivity({
        actorPhone: String(identifier ?? "-"),
        actorName: String(identifier ?? "Tidak dikenal"),
        action: "USER_LOGIN_FAILED",
        module: "AUTH",
        description: `Percobaan login gagal — akun "${identifier}" tidak ditemukan di sistem.`,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res.status(401).json({ message: "User tidak ditemukan" });
    }

    if (user.is_active === false) {
      logActivity({
        userId: user.id,
        role: user.role,
        actorPhone: user.phone_number,
        actorName: user.name,
        action: "USER_LOGIN_BLOCKED",
        module: "AUTH",
        description: `Login ditolak — akun "${user.name}" (${user.role}) sedang dibekukan oleh Superadmin.`,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res.status(403).json({ message: "Akun Anda sedang dibekukan. Hubungi Superadmin PetaniKita." });
    }

    // Verifikasi password bcrypt — hanya untuk akun yang SUDAH memiliki password.
    // Akun lama tanpa password tetap bisa masuk agar alur onboarding WA tidak terputus.
    if (user.password) {
      const isValid = password ? await bcrypt.compare(String(password), user.password) : false;
      if (!isValid) {
        logActivity({
          userId: user.id,
          role: user.role,
          actorPhone: user.phone_number,
          actorName: user.name,
          action: "USER_LOGIN_FAILED",
          module: "AUTH",
          description: `Percobaan login gagal — password salah untuk akun "${user.name}" (${user.role}).`,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
        return res.status(401).json({ message: "Password salah. Silakan periksa kembali." });
      }
    }

    logActivity({
      userId: user.id,
      role: user.role,
      actorPhone: user.phone_number,
      actorName: user.name,
      action: "USER_LOGIN",
      module: "AUTH",
      description: `Pengguna "${user.name}" (${user.role}) berhasil masuk ke sistem dari wilayah ${user.regionName ?? "-"}.`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      id: user.id,
      username: user.name,
      role: user.role,
      token: `mock_token_${user.id}`,
      latitude: user.latitude,
      longitude: user.longitude,
      regionName: user.regionName || "Kabupaten Sleman",
    });
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Login failed" });
  }
});

// OTP & Registration with Phone Verification
app.post("/api/v1/auth/request-otp", async (req: Request, res: Response) => {
  await requestOtp(req, res);
});

app.post("/api/v1/auth/verify-otp", async (req: Request, res: Response) => {
  await verifyOtp(req, res);
});

app.post("/api/v1/auth/register-otp", async (req: Request, res: Response) => {
  await registerWithOtp(req, res);
});

// Direct Registration (No OTP)
app.post("/api/v1/auth/register-direct", async (req: Request, res: Response) => {
  await registerDirect(req, res);
});

// Real-time availability check endpoints
app.get("/api/v1/auth/check-username", async (req: Request, res: Response) => {
  await checkUsername(req, res);
});

app.get("/api/v1/auth/check-phone", async (req: Request, res: Response) => {
  await checkPhone(req, res);
});

app.get("/api/v1/auth/me", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");
  const userIdStr = token.replace("mock_token_", "");
  const userId = Number(userIdStr);

  try {
    const user = await prisma.user.findUnique({
      where: { id: isNaN(userId) ? 1 : userId },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      id: user.id,
      username: user.name,
      name: user.name,
      role: user.role,
      business_type: user.business_type || "Warung Makan / Restoran",
      latitude: user.latitude,
      longitude: user.longitude,
      regionName: user.regionName || "Kabupaten Sleman",
    });
  } catch (err: unknown) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/v1/user/last-farm", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");
  const userIdStr = token.replace("mock_token_", "");
  const userId = Number(userIdStr);

  try {
    const user = await prisma.user.findUnique({
      where: { id: isNaN(userId) ? 1 : userId },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    const lastCrop = await prisma.farmCrop.findFirst({
      where: { user_id: user.id },
      orderBy: { id: "desc" },
    });

    res.json({
      latitude: lastCrop?.latitude ?? user.latitude,
      longitude: lastCrop?.longitude ?? user.longitude,
      regionName: lastCrop?.regionName ?? user.regionName,
      areaSizeM2: lastCrop?.area_size_m2 ?? null,
      cropType: lastCrop?.crop_type ?? null,
    });
  } catch (err: unknown) {
    res.status(500).json({ message: "Server error" });
  }
});

// AI PRICE SCRAPING ENDPOINTS
app.get("/api/v1/prices/scrape", async (req: Request, res: Response) => {
  await scrapePriceEndpoint(req, res);
});

app.post("/api/v1/prices/scrape-batch", async (req: Request, res: Response) => {
  await scrapeBatchPricesEndpoint(req, res);
});

app.get("/api/v1/prices/multi-region", async (req: Request, res: Response) => {
  await getMultiRegionPrices(req, res);
});

app.get("/api/v1/prices/region/:regionName", async (req: Request, res: Response) => {
  await getPricesByRegion(req, res);
});

app.get("/api/v1/prices/ensure", async (req: Request, res: Response) => {
  await ensurePriceEndpoint(req, res);
});

// REGIONAL PRICES
app.get("/api/v1/prices/regional", async (req: Request, res: Response) => {
  try {
    const { region } = req.query;

    // Jika frontend mengirim query ?region=Kabupaten Purbalingga, filter khusus region tersebut.
    // Jika TIDAK ADA query region, kembalikan harga untuk SELURUH region yang terdaftar di DB!
    const allPrices = await fetchAllRegisteredRegionalPrices();

    let filteredPrices = allPrices;
    if (region) {
      filteredPrices = allPrices.filter(
        p => p.region.toLowerCase() === (region as string).toLowerCase()
      );
    }

    const registeredRegions = await getRegisteredRegionsFromDb();

    return res.status(200).json({
      success: true,
      totalRegions: registeredRegions.length,
      data: filteredPrices,
      status: "Data_Terverifikasi_12H",
      regionName: (region as string) || registeredRegions[0] || "Kabupaten Purbalingga",
      updated_at: new Date(),
      prices: filteredPrices.map((p, idx) => ({
        id: idx + 1,
        commodity: p.commodity || p.commodityName,
        farmer_price: p.farmer_price || p.pricePerKg,
        prev_price: p.prev_price || Math.round((p.pricePerKg || 30000) * 0.95),
        umkm_price: p.umkm_price || Math.round((p.pricePerKg || 30000) * 1.2),
        hap_price: p.hap_price || Math.round((p.pricePerKg || 30000) * 1.15),
        trend: p.trend || "STABLE",
        region: p.region,
      })),
    });
  } catch (error: any) {
    console.error("[PRICES] Error fetching regional prices:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data harga regional.",
    });
  }
});

// HARVEST & ORDERS
app.get("/api/v1/harvest/user/:userId", async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const crops = await prisma.farmCrop.findMany({
      where: { user_id: userId },
      include: { harvests: true },
    });
    const events = crops.flatMap(c =>
      c.harvests.map(h => ({
        id: h.id,
        crop: c.crop_type,
        date: h.est_harvest_date.toISOString().split("T")[0],
        kg: h.est_yield_kg,
        status: h.status,
        pricePerKg: h.price_per_kg,
        uploadedAt: h.uploaded_at,
        harvestDate: h.est_harvest_date,
        deliveryReadyDate: h.delivery_ready_date,
        regionName: c.regionName || "Kabupaten Sleman",
      }))
    );
    res.json(events);
  } catch (err: unknown) {
    res.status(500).json({ message: "Gagal mengambil data panen" });
  }
});

app.post("/api/harvest", async (req: Request, res: Response) => {
  const { crop_type, area_size_m2, est_harvest_date, est_yield_kg, price_per_kg, delivery_ready_date, expiry_date, latitude, longitude, regionName, user_id } = req.body;
  try {
    const lat = latitude ?? -7.7558;
    const lng = longitude ?? 110.4052;
    const finalRegion = regionName || (await resolveRegionName(lat, lng));

    const crop = await prisma.farmCrop.create({
      data: {
        user_id: user_id ?? 1,
        crop_type,
        area_size_m2,
        latitude: lat,
        longitude: lng,
        regionName: finalRegion,
      },
    });
    const harvestDate = est_harvest_date ? new Date(est_harvest_date) : new Date();
    const harvest = await prisma.harvestEvent.create({
      data: {
        crop_id: crop.id,
        est_harvest_date: harvestDate,
        est_yield_kg,
        price_per_kg: price_per_kg ? parseFloat(price_per_kg) : null,
        delivery_ready_date: delivery_ready_date ? new Date(delivery_ready_date) : harvestDate,
        expiry_date: expiry_date ? new Date(expiry_date) : null,
        status: "AVAILABLE",
      },
    });

    ensureRegionPriceExists(finalRegion).catch(err => console.error("On-Demand Trigger error:", err));

    const farmerUser = await prisma.user.findUnique({ where: { id: crop.user_id } });
    logActivity({
      userId: crop.user_id,
      role: farmerUser?.role ?? "PETANI",
      actorPhone: farmerUser?.phone_number,
      actorName: farmerUser?.name ?? "Petani",
      action: "PANEN_POSTED",
      module: "HARVEST",
      description: `Petani "${farmerUser?.name ?? "-"}" menerbitkan panen #${harvest.id}: ${crop_type} sebanyak ${est_yield_kg} Kg @ Rp ${Number(price_per_kg || 0).toLocaleString("id-ID")}/Kg di ${finalRegion} (via Web).`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      id: harvest.id,
      regionName: finalRegion,
      uploadedAt: harvest.uploaded_at,
      harvestDate: harvest.est_harvest_date,
      deliveryReadyDate: harvest.delivery_ready_date,
    });
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Failed to create harvest" });
  }
});

app.get("/api/v1/orders/farmer/:farmerId", async (req: Request, res: Response) => {
  try {
    const farmerId = Number(req.params.farmerId);
    const crops = await prisma.farmCrop.findMany({
      where: { user_id: farmerId },
      select: { id: true, crop_type: true },
    });
    const cropIds = crops.map(c => c.id);

    const harvestEvents = await prisma.harvestEvent.findMany({
      where: { crop_id: { in: cropIds } },
      include: {
        crop: true,
        orders: {
          include: { umkm_user: true },
        },
      },
    });

    const ordersList = harvestEvents.flatMap(h =>
      h.orders.map(o => ({
        id: o.id,
        buyer: o.umkm_user.name,
        commodity: h.crop.crop_type,
        kg: o.amount_kg > 0 ? o.amount_kg : h.est_yield_kg,
        total: o.grand_total ?? o.total_amount,
        status: o.status,
        pricePerKg: o.price_per_kg,
        originalPricePerKg: o.original_price_per_kg,
        isNego: o.is_nego,
        negoReason: o.nego_reason,
        rejectionReason: o.rejection_reason,
        deliveryMethod: o.delivery_method,
        deliveryFee: o.delivery_fee,
        buyerPhone: o.umkm_user.phone_number,
        created_at: o.created_at,
      }))
    );

    res.json(ordersList);
  } catch (err: unknown) {
    res.status(500).json({ message: "Gagal mengambil pesanan petani" });
  }
});

// ORDER EDIT ENDPOINTS
app.patch("/api/v1/orders/:id/umkm-update", async (req: Request, res: Response) => {
  await updateOrderByUmkm(req, res);
});

app.post("/api/v1/procurement/checkout", async (req: Request, res: Response) => {
  await createP2POrder(req, res);
});

app.post("/api/v1/procurement/quote", async (req: Request, res: Response) => {
  await quoteP2POrder(req, res);
});

// PETANI: setujui / tolak pesanan lewat Web
app.patch("/api/v1/orders/:id/farmer-respond", async (req: Request, res: Response) => {
  await respondToOrderByFarmer(req, res);
});

app.get("/api/v1/procurement/history", async (req: Request, res: Response) => {
  const umkmId = Number(req.query.umkmId ?? 2);
  try {
    const orders = await prisma.umkmOrder.findMany({
      where: { umkm_user_id: umkmId },
      include: { harvest_event: { include: { crop: { include: { user: true } } } } },
      orderBy: { created_at: "desc" },
    });
    res.json(orders);
  } catch (err: unknown) {
    res.status(500).json({ message: "Gagal mengambil riwayat procurement" });
  }
});

app.get("/api/v1/procurement/orders", async (req: Request, res: Response) => {
  const umkmId = Number(req.query.umkmId ?? 2);
  try {
    const orders = await prisma.umkmOrder.findMany({
      where: { umkm_user_id: umkmId },
      include: { harvest_event: { include: { crop: { include: { user: true } } } } },
      orderBy: { created_at: "desc" },
    });
    res.json(orders);
  } catch (err: unknown) {
    res.status(500).json({ message: "Gagal mengambil riwayat order" });
  }
});

// NEGOTIATION ENDPOINTS (PUBLIC MARKETPLACE)
app.post("/api/v1/public/negotiate", async (req: Request, res: Response) => {
  const { harvest_event_id, buyer_name, buyer_phone, commodity, quantity_kg, normal_price, proposed_price, reason } = req.body;

  try {
    const negotiation = await prisma.priceNegotiation.create({
      data: {
        harvest_event_id: Number(harvest_event_id),
        buyer_name,
        buyer_phone,
        commodity,
        quantity_kg: parseFloat(quantity_kg),
        normal_price: parseFloat(normal_price),
        proposed_price: parseFloat(proposed_price),
        reason: reason || "",
        status: "PENDING",
      },
    });

    logActivity({
      actorPhone: buyer_phone,
      actorName: buyer_name,
      role: "UMKM",
      action: "NEGO_SUBMITTED",
      module: "ORDER",
      description: `Pembeli "${buyer_name}" (${buyer_phone}) mengajukan nego harga ${commodity} sebanyak ${quantity_kg} Kg: Rp ${Number(normal_price).toLocaleString("id-ID")} → Rp ${Number(proposed_price).toLocaleString("id-ID")}/Kg. Alasan: ${reason || "-"}.`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      message: "✓ Penawaran nego harga berhasil dikirim ke Petani!",
      data: negotiation,
    });
  } catch (err: unknown) {
    res.status(400).json({ success: false, message: "Gagal mengirim penawaran nego" });
  }
});

// FARMER NEGOTIATION MANAGEMENT (multi-channel: Web UMKM, WA Bot, Marketplace publik)
app.get("/api/v1/farmer/negotiations", async (req: Request, res: Response) => {
  await getFarmerNegotiations(req, res);
});

app.post("/api/v1/farmer/negotiations/:id/decide", async (req: Request, res: Response) => {
  await respondToNegotiation(req, res);
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// SUPERADMIN PANEL ENDPOINTS
app.get("/api/v1/admin/logs", async (req: Request, res: Response) => {
  await getAuditLogs(req, res);
});

app.get("/api/v1/admin/stats", async (req: Request, res: Response) => {
  await getAdminStats(req, res);
});

app.get("/api/v1/admin/regional-prices", async (req: Request, res: Response) => {
  await getRegionalPriceMonitoring(req, res);
});

app.get("/api/v1/admin/users", async (req: Request, res: Response) => {
  await getUsersManagement(req, res);
});

app.post("/api/v1/admin/users", async (req: Request, res: Response) => {
  await createUserByAdmin(req, res);
});

app.patch("/api/v1/admin/users/:id/toggle-status", async (req: Request, res: Response) => {
  await toggleUserStatus(req, res);
});

app.patch("/api/v1/admin/users/:id/role", async (req: Request, res: Response) => {
  await promoteUserRole(req, res);
});

app.post("/api/v1/admin/users/:id/reset-password", async (req: Request, res: Response) => {
  await resetUserPassword(req, res);
});

app.get("/api/v1/admin/orders", async (req: Request, res: Response) => {
  await getAllOrders(req, res);
});

app.post("/api/v1/admin/broadcast-wa", async (req: Request, res: Response) => {
  await sendWaBroadcast(req, res);
});

app.post("/api/v1/admin/users/:id/impersonate", async (req: Request, res: Response) => {
  await impersonateUser(req, res);
});

// Superadmin routes handled by superadmin.route.ts (mounted above via app.use)

app.get("/api/v1/admin/geo-radar", async (req: Request, res: Response) => {
  await getGeoRadar(req, res);
});

app.get("/api/v1/admin/wa-status", async (req: Request, res: Response) => {
  await getWaBotStatusEndpoint(req, res);
});

app.get("/api/v1/admin/broadcast-jobs", async (req: Request, res: Response) => {
  await getBroadcastJobsEndpoint(req, res);
});

app.get("/api/v1/admin/broadcast-progress/:jobId", async (req: Request, res: Response) => {
  await getBroadcastProgress(req, res);
});

// WHATSAPP BOT ENDPOINTS
app.post("/api/v1/wa/send", async (req: Request, res: Response) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ success: false, message: "phone dan message wajib diisi" });
  }
  try {
    const result = await sendHumanLikeMessageToPhone(phone, message);
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: String(err) });
  }
});

app.post("/api/v1/wa/notify-farmer", async (req: Request, res: Response) => {
  const { phone, name, commodity, qtyKg } = req.body;
  if (!phone || !name || !commodity || !qtyKg) {
    return res.status(400).json({ success: false, message: "phone, name, commodity, qtyKg wajib diisi" });
  }
  try {
    const sock = getSocket();
    if (!sock) throw new Error("WhatsApp belum terkoneksi");
    await notifyFarmerOnNewOrder(sock, phone, name, commodity, Number(qtyKg));
    res.json({ success: true, message: "Notifikasi terkirim ke petani" });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: String(err) });
  }
});

app.post("/api/v1/wa/notify-umkm", async (req: Request, res: Response) => {
  const { phone, name, commodity, qtyKg, totalPrice } = req.body;
  if (!phone || !name || !commodity || !qtyKg || !totalPrice) {
    return res.status(400).json({ success: false, message: "phone, name, commodity, qtyKg, totalPrice wajib diisi" });
  }
  try {
    const sock = getSocket();
    if (!sock) throw new Error("WhatsApp belum terkoneksi");
    await notifyUmkmOnOrderConfirmation(sock, phone, name, commodity, Number(qtyKg), Number(totalPrice));
    res.json({ success: true, message: "Konfirmasi terkirim ke UMKM" });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: String(err) });
  }
});

app.get("/api/v1/wa/status", (req: Request, res: Response) => {
  res.json({ connected: isWaConnected() });
});

// Force reconnect: clear auth session & restart Baileys to force QR generation
app.post("/api/v1/superadmin/wa-reconnect", async (req: Request, res: Response) => {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const { stopWhatsAppService } = await import("./services/whatsapp.service.js");
    // 1. Tutup socket lama dulu agar tidak ada race yang menulis ulang sesi
    stopWhatsAppService();
    // 2. Hapus folder sesi lama
    const authFolder = path.resolve(process.cwd(), "auth_info_baileys");
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true });
      console.log("[WA] Auth session cleared for re-scan.");
    }
    // 3. Reset state engine
    const { waEngineState } = await import("./services/whatsappBot.service.js");
    waEngineState.status = "OFFLINE";
    waEngineState.qrCodeBase64 = "";
    waEngineState.botPhone = "";
    // 4. Restart WA service (generate QR baru)
    setTimeout(() => startWhatsAppService().catch(console.error), 500);
    res.json({ success: true, message: "Sesi WA dihapus. Silakan scan QR baru dalam 3-5 detik." });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
});

// Set WA_BOT_ENABLED=false di .env untuk menjalankan sistem tanpa Bot WhatsApp.
const WA_BOT_ENABLED = process.env.WA_BOT_ENABLED !== "false";

app.listen(PORT, async () => {
  console.log(`✓ PetaniKita MariaDB Backend API running on port ${PORT}`);

  if (!WA_BOT_ENABLED) {
    console.log("[WA] ⏸️  WhatsApp Bot DINONAKTIFKAN (WA_BOT_ENABLED=false).");
    console.log("[WA]    Seluruh fitur Web tetap berjalan normal tanpa notifikasi WhatsApp.");
    return;
  }

  try {
    await startWhatsAppService();
    console.log("[WA] WhatsApp Bot service starting...");
  } catch (err) {
    console.error("[WA] Gagal memulai WhatsApp service:", err);
  }
});
