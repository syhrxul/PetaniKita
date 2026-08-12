import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { logActivity } from "../services/auditLog.service.js";
import { sanitizePhoneTo62, formatToWaJid } from "../utils/phoneSanitizer.js";
import { resolveRegionName } from "../utils/geocoding.js";
import { getSocket, isWaConnected, getWaBotStatus } from "../services/whatsapp.service.js";
import { sendHumanLikeWaMessage } from "../services/whatsappBot.service.js";

// ============================================================
// Broadcast Job Store — tracking progress per recipient
// ============================================================
export interface BroadcastRecipient {
  name: string;
  phone: string;
  role: string;
  status: "PENDING" | "TYPING" | "SENT" | "FAILED";
  timestamp?: string;
  error?: string;
}

interface BroadcastJob {
  id: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  targetRole: string;
  message: string;
  totalRecipients: number;
  sent: number;
  failed: number;
  recipients: BroadcastRecipient[];
  startedAt: string;
  completedAt?: string;
}

const broadcastJobs = new Map<string, BroadcastJob>();

export function getBroadcastJob(jobId: string): BroadcastJob | null {
  return broadcastJobs.get(jobId) ?? null;
}

export function getAllBroadcastJobs(): BroadcastJob[] {
  return Array.from(broadcastJobs.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

const VALID_ROLES = ["PETANI", "UMKM", "SUPERADMIN"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

function actorFromReq(req: any) {
  return {
    ipAddress: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.headers?.["user-agent"] || null,
    actorName: (req.headers?.["x-actor-name"] as string) || "Superadmin",
    userId: (req.headers?.["x-actor-id"] as string) || null,
  };
}

/**
 * GET /api/v1/admin/logs
 * Query: ?module=AUTH&action=USER_LOGIN&search=budi&page=1&limit=50
 */
export async function getAuditLogs(req: any, res: any) {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    const { module, action, search } = req.query;

    const where: any = {};
    if (module && module !== "ALL") where.module = String(module);
    if (action && action !== "ALL") where.action = String(action);
    if (search) {
      const q = String(search);
      where.OR = [
        { actorName: { contains: q } },
        { actorPhone: { contains: q } },
        { description: { contains: q } },
        { action: { contains: q } },
        { userId: { contains: q } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return res.json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      count: logs.length,
      data: logs.map(l => ({
        ...l,
        createdAtWib: new Date(l.createdAt).toLocaleString("id-ID", {
          timeZone: "Asia/Jakarta",
          dateStyle: "medium",
          timeStyle: "medium",
        }),
      })),
    });
  } catch (error) {
    console.error("[ADMIN] getAuditLogs error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengambil audit logs." });
  }
}

/**
 * GET /api/v1/admin/regional-prices
 * Pemetaan harga komoditas terkini per kabupaten/kota berbasis AI Price Engine + data panen riil.
 */
export async function getRegionalPriceMonitoring(_req: any, res: any) {
  try {
    const [priceHistories, crops] = await Promise.all([
      prisma.priceHistory.findMany({ orderBy: { updated_at: "desc" } }),
      prisma.farmCrop.findMany({ include: { harvests: true } }),
    ]);

    // Agregasi harga riil dari panen petani per region + komoditas
    const harvestAgg = new Map<
      string,
      { region: string; commodity: string; prices: number[]; totalKg: number; farmers: Set<number> }
    >();

    for (const crop of crops) {
      const region = crop.regionName?.trim() || "Wilayah Belum Terdaftar";
      for (const h of crop.harvests) {
        if (!h.price_per_kg || h.price_per_kg <= 0) continue;
        const key = `${region}||${crop.crop_type}`;
        const entry =
          harvestAgg.get(key) ??
          { region, commodity: crop.crop_type, prices: [], totalKg: 0, farmers: new Set<number>() };
        entry.prices.push(h.price_per_kg);
        entry.totalKg += h.est_yield_kg || 0;
        entry.farmers.add(crop.user_id);
        harvestAgg.set(key, entry);
      }
    }

    const regionMap = new Map<string, any>();

    const ensureRegion = (region: string) => {
      if (!regionMap.has(region)) {
        regionMap.set(region, { regionName: region, commodities: [] as any[] });
      }
      return regionMap.get(region);
    };

    for (const entry of harvestAgg.values()) {
      const min = Math.min(...entry.prices);
      const max = Math.max(...entry.prices);
      const avg = Math.round(entry.prices.reduce((a, b) => a + b, 0) / entry.prices.length);

      const ref = priceHistories.find(
        p => p.regionName === entry.region && p.commodity === entry.commodity
      );

      ensureRegion(entry.region).commodities.push({
        commodity: entry.commodity,
        lowestPrice: min,
        highestPrice: max,
        avgPrice: avg,
        refFarmerPrice: ref?.farmer_price ?? avg,
        umkmPrice: ref?.umkm_price ?? Math.round(avg * 1.2),
        hapPrice: ref?.hap_price ?? Math.round(avg * 1.15),
        trend: ref?.trend ?? "STABLE",
        totalListings: entry.prices.length,
        totalStockKg: Math.round(entry.totalKg * 10) / 10,
        totalFarmers: entry.farmers.size,
        source: "HARVEST_REAL",
        updatedAt: ref?.updated_at ?? new Date(),
      });
    }

    // Lengkapi dengan data AI Price Engine (price_histories) yang belum tercakup panen riil
    for (const p of priceHistories) {
      const region = p.regionName?.trim() || "Wilayah Belum Terdaftar";
      const bucket = ensureRegion(region);
      const exists = bucket.commodities.some((c: any) => c.commodity === p.commodity);
      if (exists) continue;

      bucket.commodities.push({
        commodity: p.commodity,
        lowestPrice: p.farmer_price,
        highestPrice: p.farmer_price,
        avgPrice: p.farmer_price,
        refFarmerPrice: p.farmer_price,
        umkmPrice: p.umkm_price,
        hapPrice: p.hap_price,
        trend: p.trend,
        totalListings: 0,
        totalStockKg: 0,
        totalFarmers: 0,
        source: "AI_PRICE_ENGINE",
        updatedAt: p.updated_at,
      });
    }

    const regions = Array.from(regionMap.values()).map(r => {
      const avgAll = r.commodities.length
        ? Math.round(
            r.commodities.reduce((a: number, c: any) => a + c.avgPrice, 0) / r.commodities.length
          )
        : 0;
      return {
        ...r,
        totalCommodities: r.commodities.length,
        avgRegionPrice: avgAll,
        totalStockKg:
          Math.round(r.commodities.reduce((a: number, c: any) => a + c.totalStockKg, 0) * 10) / 10,
      };
    });

    regions.sort((a, b) => a.regionName.localeCompare(b.regionName));

    return res.json({
      success: true,
      totalRegions: regions.length,
      updatedAt: new Date(),
      data: regions,
    });
  } catch (error) {
    console.error("[ADMIN] getRegionalPriceMonitoring error:", error);
    return res.status(500).json({ success: false, message: "Gagal memuat harga regional." });
  }
}

/**
 * GET /api/v1/admin/users
 * Query: ?role=PETANI&status=ACTIVE&search=budi
 */
export async function getAllUsers(req: any, res: any) {
  try {
    const { role, status, search } = req.query;

    const where: any = {};
    if (role && role !== "ALL") where.role = String(role);
    if (status === "ACTIVE") where.is_active = true;
    if (status === "SUSPENDED") where.is_active = false;
    if (search) {
      const q = String(search);
      where.OR = [{ name: { contains: q } }, { phone_number: { contains: q } }, { regionName: { contains: q } }];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        _count: { select: { farm_crops: true, orders: true } },
      },
    });

    return res.json({
      success: true,
      total: users.length,
      summary: {
        farmers: users.filter(u => u.role === "PETANI").length,
        umkm: users.filter(u => u.role === "UMKM").length,
        superadmin: users.filter(u => u.role === "SUPERADMIN").length,
        active: users.filter(u => u.is_active).length,
        suspended: users.filter(u => !u.is_active).length,
      },
      data: users.map(u => ({
        id: u.id,
        name: u.name,
        phone_number: u.phone_number,
        waUrl: `https://wa.me/${sanitizePhoneTo62(u.phone_number)}`,
        role: u.role,
        business_type: u.business_type,
        is_active: u.is_active,
        hasPassword: Boolean(u.password),
        latitude: u.latitude,
        longitude: u.longitude,
        regionName: u.regionName,
        mapsUrl: `https://www.google.com/maps?q=${u.latitude},${u.longitude}`,
        totalCrops: u._count.farm_crops,
        totalOrders: u._count.orders,
        created_at: u.created_at,
        createdAtWib: new Date(u.created_at).toLocaleString("id-ID", {
          timeZone: "Asia/Jakarta",
          dateStyle: "medium",
          timeStyle: "short",
        }),
      })),
    });
  } catch (error) {
    console.error("[ADMIN] getAllUsers error:", error);
    return res.status(500).json({ success: false, message: "Gagal memuat daftar pengguna." });
  }
}

/**
 * POST /api/v1/admin/users
 * body: { name, phone_number, role, password, latitude?, longitude?, regionName?, business_type? }
 */
export async function createUserByAdmin(req: any, res: any) {
  const actor = actorFromReq(req);
  try {
    const { name, phone_number, role, password, latitude, longitude, regionName, business_type } =
      req.body;

    if (!name || !phone_number || !role) {
      return res
        .status(400)
        .json({ success: false, message: "Nama, No. WhatsApp, dan Peran wajib diisi." });
    }

    const userRole = String(role).toUpperCase() as ValidRole;
    if (!VALID_ROLES.includes(userRole)) {
      return res
        .status(400)
        .json({ success: false, message: `Peran "${role}" tidak valid. Pilihan: PETANI, UMKM, SUPERADMIN.` });
    }

    if (password && String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Password minimal 6 karakter." });
    }

    const existing = await prisma.user.findUnique({ where: { phone_number } });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: `No. WhatsApp "${phone_number}" sudah terdaftar.` });
    }

    const lat = latitude !== undefined && latitude !== null ? Number(latitude) : -7.7558;
    const lng = longitude !== undefined && longitude !== null ? Number(longitude) : 110.4052;
    const finalRegion = regionName || (await resolveRegionName(lat, lng));
    const hashed = password ? await bcrypt.hash(String(password), 10) : null;

    const user = await prisma.user.create({
      data: {
        username: name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() + Date.now(),
        name,
        phone_number,
        role: userRole,
        business_type: business_type || null,
        password: hashed,
        latitude: lat,
        longitude: lng,
        regionName: finalRegion,
        is_active: true,
      },
    });

    logActivity({
      userId: user.id,
      role: user.role,
      actorPhone: user.phone_number,
      actorName: actor.actorName,
      action: "ADMIN_USER_CREATED",
      module: "ADMIN",
      description: `Superadmin membuat user baru "${user.name}" (${user.role}) di wilayah ${finalRegion} dengan nomor ${user.phone_number}.`,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return res.status(201).json({
      success: true,
      message: `✓ User "${user.name}" (${user.role}) berhasil dibuat.`,
      data: {
        id: user.id,
        name: user.name,
        phone_number: user.phone_number,
        role: user.role,
        regionName: user.regionName,
        is_active: user.is_active,
      },
    });
  } catch (error) {
    console.error("[ADMIN] createUserByAdmin error:", error);
    return res.status(500).json({ success: false, message: "Gagal membuat pengguna baru." });
  }
}

/**
 * PATCH /api/v1/admin/users/:id/toggle-status
 */
export async function toggleUserStatus(req: any, res: any) {
  const actor = actorFromReq(req);
  try {
    const userId = Number(req.params.id);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ success: false, message: "ID pengguna tidak valid." });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });

    const nextStatus = typeof req.body?.is_active === "boolean" ? req.body.is_active : !user.is_active;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { is_active: nextStatus },
    });

    logActivity({
      userId: updated.id,
      role: updated.role,
      actorPhone: updated.phone_number,
      actorName: actor.actorName,
      action: nextStatus ? "ADMIN_USER_ACTIVATED" : "ADMIN_USER_SUSPENDED",
      module: "ADMIN",
      description: nextStatus
        ? `Superadmin mengaktifkan kembali akun "${updated.name}" (${updated.role}).`
        : `Superadmin membekukan (suspend) akun "${updated.name}" (${updated.role}). Alasan: ${req.body?.reason || "Tidak dicantumkan"}.`,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return res.json({
      success: true,
      message: nextStatus
        ? `✓ Akun "${updated.name}" berhasil diaktifkan kembali.`
        : `✓ Akun "${updated.name}" berhasil dibekukan.`,
      data: { id: updated.id, name: updated.name, is_active: updated.is_active },
    });
  } catch (error) {
    console.error("[ADMIN] toggleUserStatus error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengubah status akun." });
  }
}

/**
 * PATCH /api/v1/admin/users/:id/role
 */
export async function updateUserRole(req: any, res: any) {
  const actor = actorFromReq(req);
  try {
    const userId = Number(req.params.id);
    const newRole = String(req.body?.role || "").toUpperCase() as ValidRole;

    if (!VALID_ROLES.includes(newRole)) {
      return res.status(400).json({ success: false, message: "Peran tidak valid." });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });

    const updated = await prisma.user.update({ where: { id: userId }, data: { role: newRole } });

    logActivity({
      userId: updated.id,
      role: updated.role,
      actorPhone: updated.phone_number,
      actorName: actor.actorName,
      action: "ADMIN_USER_ROLE_CHANGED",
      module: "ADMIN",
      description: `Superadmin mengubah peran "${updated.name}" dari ${user.role} menjadi ${newRole}.`,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return res.json({
      success: true,
      message: `✓ Peran "${updated.name}" diubah menjadi ${newRole}.`,
      data: { id: updated.id, role: updated.role },
    });
  } catch (error) {
    console.error("[ADMIN] updateUserRole error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengubah peran pengguna." });
  }
}

/**
 * POST /api/v1/admin/users/:id/reset-password
 * body: { newPassword? } — jika kosong, sistem generate password acak.
 */
export async function resetUserPassword(req: any, res: any) {
  const actor = actorFromReq(req);
  try {
    const userId = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });

    const rawPassword =
      req.body?.newPassword && String(req.body.newPassword).length >= 6
        ? String(req.body.newPassword)
        : `panen${Math.floor(100000 + Math.random() * 900000)}`;

    const hashed = await bcrypt.hash(rawPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

    logActivity({
      userId: user.id,
      role: user.role,
      actorPhone: user.phone_number,
      actorName: actor.actorName,
      action: "ADMIN_PASSWORD_RESET",
      module: "ADMIN",
      description: `Superadmin melakukan reset password untuk akun "${user.name}" (${user.role}).`,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return res.json({
      success: true,
      message: `✓ Password "${user.name}" berhasil direset.`,
      data: { id: user.id, temporaryPassword: rawPassword },
    });
  } catch (error) {
    console.error("[ADMIN] resetUserPassword error:", error);
    return res.status(500).json({ success: false, message: "Gagal mereset password." });
  }
}

/**
 * GET /api/v1/admin/orders — pantau seluruh transaksi P2P nasional
 */
export async function getAllOrders(req: any, res: any) {
  try {
    const { status, search } = req.query;
    const where: any = {};
    if (status && status !== "ALL") where.status = String(status);

    const orders = await prisma.umkmOrder.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: 300,
      include: {
        umkm_user: true,
        harvest_event: { include: { crop: { include: { user: true } } } },
      },
    });

    const mapped = orders.map(o => {
      const farmer = o.harvest_event?.crop?.user;
      return {
        id: o.id,
        status: o.status,
        commodity: o.harvest_event?.crop?.crop_type ?? "Komoditas",
        quantityKg: o.amount_kg,
        pricePerKg: o.price_per_kg ?? 0,
        originalPricePerKg: o.original_price_per_kg ?? 0,
        isNego: o.is_nego,
        negoReason: o.nego_reason,
        rejectionReason: o.rejection_reason,
        grandTotal: o.grand_total ?? o.total_amount,
        deliveryMethod: o.delivery_method,
        deliveryFee: o.delivery_fee ?? 0,
        distanceKm: o.distance_km,
        buyerName: o.umkm_user?.name ?? "-",
        buyerPhone: o.umkm_user?.phone_number ?? "-",
        buyerRegion: o.umkm_user?.regionName ?? "-",
        farmerName: farmer?.name ?? "-",
        farmerPhone: farmer?.phone_number ?? "-",
        farmerRegion: o.harvest_event?.crop?.regionName ?? "-",
        created_at: o.created_at,
        createdAtWib: new Date(o.created_at).toLocaleString("id-ID", {
          timeZone: "Asia/Jakarta",
          dateStyle: "medium",
          timeStyle: "short",
        }),
      };
    });

    const filtered = search
      ? mapped.filter(o =>
          `${o.commodity} ${o.buyerName} ${o.farmerName} ${o.buyerRegion} ${o.farmerRegion}`
            .toLowerCase()
            .includes(String(search).toLowerCase())
        )
      : mapped;

    return res.json({
      success: true,
      total: filtered.length,
      summary: {
        pending: mapped.filter(o => o.status === "PENDING_FARMER_CONFIRMATION").length,
        nego: mapped.filter(o => o.status === "WAITING_FARMER_NEGO_APPROVAL").length,
        accepted: mapped.filter(o => o.status === "ACCEPTED").length,
        rejected: mapped.filter(o => o.status === "REJECTED").length,
        completed: mapped.filter(o => o.status === "COMPLETED").length,
        totalValue: mapped.reduce((a, o) => a + (o.grandTotal || 0), 0),
      },
      data: filtered,
    });
  } catch (error) {
    console.error("[ADMIN] getAllOrders error:", error);
    return res.status(500).json({ success: false, message: "Gagal memuat transaksi P2P." });
  }
}

/**
 * GET /api/v1/admin/wa-status
 * Status koneksi WhatsApp Bot terkini + QR Code Base64 (jika perlu scan).
 */
export async function getWaBotStatusEndpoint(_req: any, res: any) {
  try {
    const { status, qrCodeBase64 } = getWaBotStatus();
    return res.json({
      success: true,
      data: {
        status, // 'DISCONNECTED' | 'SCAN_QR_REQUIRED' | 'CONNECTED'
        qrCodeBase64, // 'data:image/png;base64,...' atau null
        waConnected: isWaConnected(),
      },
    });
  } catch (error) {
    console.error("[ADMIN] getWaBotStatus error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengambil status WA." });
  }
}

/**
 * GET /api/v1/admin/stats — ringkasan KPI panel superadmin
 */
export async function getAdminStats(_req: any, res: any) {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalUsers, activeUsers, totalHarvests, totalOrders, logs24h, totalRegions] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { is_active: true } }),
        prisma.harvestEvent.count(),
        prisma.umkmOrder.count(),
        prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
        prisma.priceHistory.findMany({ select: { regionName: true }, distinct: ["regionName"] }),
      ]);

    return res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        suspendedUsers: totalUsers - activeUsers,
        totalHarvests,
        totalOrders,
        logs24h,
        totalRegions: totalRegions.length,
        waConnected: isWaConnected(),
      },
    });
  } catch (error) {
    console.error("[ADMIN] getAdminStats error:", error);
    return res.status(500).json({ success: false, message: "Gagal memuat statistik admin." });
  }
}

/**
 * POST /api/v1/admin/broadcast-wa
 * body: { targetRole: 'ALL' | 'PETANI' | 'UMKM' | 'FARMER', message: string }
 * Mengirim pengumuman resmi ke seluruh mitra via WhatsApp Bot (throttled).
 */
export async function sendWaBroadcast(req: any, res: any) {
  const actor = actorFromReq(req);
  try {
    const { targetRole, message, delay, dryRun } = req.body;
    const text = String(message ?? "").trim();

    if (!text) {
      return res.status(400).json({ success: false, message: "Pesan pengumuman tidak boleh kosong." });
    }

    // Validasi delay (detik per user)
    const perUserDelay = Math.min(10, Math.max(1, Number(delay) || 2));

    // 'FARMER' dari UI lama dipetakan ke 'PETANI' sesuai enum UserRole di skema
    const rawTarget = String(targetRole ?? "ALL").toUpperCase();
    const target = rawTarget === "FARMER" ? "PETANI" : rawTarget;

    if (!["ALL", "PETANI", "UMKM"].includes(target)) {
      return res.status(400).json({
        success: false,
        message: `Target "${targetRole}" tidak valid. Pilihan: ALL, PETANI, atau UMKM.`,
      });
    }

    // Superadmin tidak pernah menjadi penerima broadcast mitra
    const where: any = { is_active: true, role: { in: ["PETANI", "UMKM"] } };
    if (target === "PETANI" || target === "UMKM") where.role = target;

    const recipients = await prisma.user.findMany({
      where,
      select: { id: true, name: true, phone_number: true, role: true },
    });

    if (recipients.length === 0) {
      return res.status(404).json({ success: false, message: "Tidak ada mitra aktif pada target tersebut." });
    }

    const sock = getSocket();
    if (!sock || !isWaConnected()) {
      logActivity({
        actorName: actor.actorName,
        role: "SUPERADMIN",
        action: "WA_BROADCAST_FAILED",
        module: "ADMIN",
        description: `Broadcast ke ${target} GAGAL — WhatsApp Bot sedang tidak terhubung. Isi pesan: "${text.slice(0, 120)}".`,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });
      return res.status(503).json({
        success: false,
        message: "WhatsApp Bot belum terhubung. Scan QR terlebih dahulu, lalu ulangi broadcast.",
      });
    }

    const targetLabel =
      target === "PETANI" ? "Petani" : target === "UMKM" ? "UMKM Kuliner" : "Semua Mitra";

    // Mode simulasi: hitung penerima tanpa benar-benar mengirim pesan WA
    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        message: `[SIMULASI] Broadcast akan dikirim ke ${recipients.length} mitra ${targetLabel}. Tidak ada pesan WA yang terkirim.`,
        data: {
          totalRecipients: recipients.length,
          targetRole: target,
          recipients: recipients.map(r => ({ name: r.name, phone: r.phone_number, role: r.role })),
        },
      });
    }

    // Buat job ID untuk tracking progress
    const jobId = `broadcast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const jobRecipients: BroadcastRecipient[] = recipients.map(r => ({
      name: r.name,
      phone: r.phone_number,
      role: r.role,
      status: "PENDING",
    }));

    const job: BroadcastJob = {
      id: jobId,
      status: "RUNNING",
      targetRole: target,
      message: text,
      totalRecipients: recipients.length,
      sent: 0,
      failed: 0,
      recipients: jobRecipients,
      startedAt: new Date().toISOString(),
    };
    broadcastJobs.set(jobId, job);

    // Proses broadcast di background
    processBroadcastJob(jobId, sock, text, perUserDelay, targetLabel, actor);

    logActivity({
      actorName: actor.actorName,
      role: "SUPERADMIN",
      action: "WA_BROADCAST_SENT",
      module: "ADMIN",
      description: `Superadmin memulai broadcast WhatsApp ke ${targetLabel} (${recipients.length} mitra, delay ${perUserDelay}s/user). Isi pesan: "${text.slice(0, 160)}".`,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return res.status(200).json({
      success: true,
      message: `Broadcast sedang dikirimkan ke ${recipients.length} mitra ${targetLabel}.`,
      data: {
        jobId,
        totalRecipients: recipients.length,
        targetRole: target,
        delay: perUserDelay,
        recipients: recipients.map(r => ({ name: r.name, phone: r.phone_number, role: r.role })),
      },
    });
  } catch (error) {
    console.error("[ADMIN] sendWaBroadcast error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengirim broadcast." });
  }
}

/**
 * POST /api/v1/admin/users/:id/impersonate
 * Superadmin masuk sebagai user untuk keperluan bantuan (jejak tercatat di audit log).
 */
/**
 * Proses broadcast di background — dengan animasi typing + delay per recipient.
 */
async function processBroadcastJob(
  jobId: string,
  sock: any,
  text: string,
  perUserDelay: number,
  targetLabel: string,
  actor: { actorName: string; ipAddress: string | null; userAgent: string | null }
) {
  const job = broadcastJobs.get(jobId);
  if (!job) return;

  try {
    for (let i = 0; i < job.recipients.length; i++) {
      const recipient = job.recipients[i];
      if (!recipient.phone) {
        recipient.status = "FAILED";
        recipient.error = "Tidak punya nomor telepon";
        job.failed++;
        continue;
      }

      // Animasi typing (simulasi mengetik)
      recipient.status = "TYPING";
      try {
        const jid = formatToWaJid(recipient.phone);
        await sock.sendPresenceUpdate("composing", jid);
      } catch {
        // ignore typing error
      }

      // Delay sebelum kirim (agar terlihat manusia)
      await new Promise(r => setTimeout(r, perUserDelay * 1000));

      // Kirim pesan
      const broadcastMsg =
        `📢 *PENGUMUMAN RESMI PETANIKITA*\n\n` +
        `Halo ${recipient.name},\n\n` +
        `${text}\n\n` +
        `_Pesan ini dikirim otomatis oleh Sistem Superadmin PetaniKita._`;
      try {
        await sendHumanLikeWaMessage(sock, formatToWaJid(recipient.phone), broadcastMsg);
        recipient.status = "SENT";
        recipient.timestamp = new Date().toISOString();
        job.sent++;
      } catch (err) {
        recipient.status = "FAILED";
        recipient.error = err instanceof Error ? err.message : "Gagal mengirim";
        job.failed++;
      }

      // Stop typing
      try {
        await sock.sendPresenceUpdate("paused", formatToWaJid(recipient.phone));
      } catch {
        // ignore
      }
    }

    job.status = "COMPLETED";
    job.completedAt = new Date().toISOString();

    logActivity({
      actorName: actor.actorName,
      role: "SUPERADMIN",
      action: "WA_BROADCAST_COMPLETED",
      module: "ADMIN",
      description: `Broadcast WA ke ${targetLabel} selesai — ${job.sent} terkirim, ${job.failed} gagal dari ${job.totalRecipients} penerima.`,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    console.log(`[BROADCAST ${jobId}] Selesai: ${job.sent} terkirim, ${job.failed} gagal.`);
  } catch (error) {
    job.status = "FAILED";
    job.completedAt = new Date().toISOString();
    console.error(`[BROADCAST ${jobId}] Error:`, error);
  }
}

/**
 * GET /api/v1/admin/broadcast-progress/:jobId
 * Mengambil progress broadcast per recipient.
 */
export async function getBroadcastProgress(req: any, res: any) {
  try {
    const jobId = req.params.jobId;
    const job = broadcastJobs.get(jobId);

    if (!job) {
      return res.status(404).json({ success: false, message: "Job broadcast tidak ditemukan." });
    }

    return res.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        totalRecipients: job.totalRecipients,
        sent: job.sent,
        failed: job.failed,
        progress: job.totalRecipients > 0 ? Math.round(((job.sent + job.failed) / job.totalRecipients) * 100) : 0,
        recipients: job.recipients,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      },
    });
  } catch (error) {
    console.error("[ADMIN] getBroadcastProgress error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengambil progress broadcast." });
  }
}

/**
 * GET /api/v1/admin/broadcast-jobs
 * Mengambil daftar semua job broadcast (untuk history).
 */
export async function getBroadcastJobsEndpoint(_req: any, res: any) {
  try {
    const jobs = getAllBroadcastJobs().map(j => ({
      jobId: j.id,
      status: j.status,
      targetRole: j.targetRole,
      totalRecipients: j.totalRecipients,
      sent: j.sent,
      failed: j.failed,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
    }));

    return res.json({
      success: true,
      total: jobs.length,
      data: jobs,
    });
  } catch (error) {
    console.error("[ADMIN] getBroadcastJobs error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengambil daftar job broadcast." });
  }
}

export async function impersonateUser(req: any, res: any) {
  const actor = actorFromReq(req);
  try {
    const userId = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });

    if (!user.is_active) {
      return res.status(409).json({
        success: false,
        message: "Akun sedang dibekukan. Aktifkan kembali sebelum melakukan impersonate.",
      });
    }

    logActivity({
      userId: user.id,
      role: user.role,
      actorPhone: user.phone_number,
      actorName: actor.actorName,
      action: "ADMIN_IMPERSONATE",
      module: "ADMIN",
      description: `Superadmin masuk sebagai (impersonate) akun "${user.name}" (${user.role}) untuk keperluan bantuan teknis.`,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return res.json({
      success: true,
      message: `Sesi impersonate untuk "${user.name}" dibuat.`,
      data: {
        id: user.id,
        username: user.name,
        role: user.role,
        token: `mock_token_${user.id}`,
        latitude: user.latitude,
        longitude: user.longitude,
        regionName: user.regionName,
      },
    });
  } catch (error) {
    console.error("[ADMIN] impersonateUser error:", error);
    return res.status(500).json({ success: false, message: "Gagal membuat sesi impersonate." });
  }
}

/**
 * GET /api/v1/admin/geo-radar
 * Sebaran GPS Petani vs UMKM + kepadatan transaksi per wilayah (radius <100 km).
 */
export async function getGeoRadar(_req: any, res: any) {
  try {
    const [users, orders] = await Promise.all([
      prisma.user.findMany({
        where: { role: { in: ["PETANI", "UMKM"] } },
        select: {
          id: true, name: true, role: true, latitude: true, longitude: true,
          regionName: true, phone_number: true, is_active: true,
        },
      }),
      prisma.umkmOrder.findMany({
        include: { harvest_event: { include: { crop: true } }, umkm_user: true },
      }),
    ]);

    const regionMap = new Map<string, any>();
    const ensure = (name: string) => {
      const key = name?.trim() || "Wilayah Belum Terdaftar";
      if (!regionMap.has(key)) {
        regionMap.set(key, {
          regionName: key, farmers: 0, umkm: 0, totalOrders: 0,
          totalValue: 0, avgDistanceKm: 0, _distances: [] as number[],
          latSum: 0, lngSum: 0, points: 0,
        });
      }
      return regionMap.get(key);
    };

    for (const u of users) {
      const bucket = ensure(u.regionName || "");
      if (u.role === "PETANI") bucket.farmers++;
      else bucket.umkm++;
      bucket.latSum += u.latitude;
      bucket.lngSum += u.longitude;
      bucket.points++;
    }

    for (const o of orders) {
      const region = o.harvest_event?.crop?.regionName || o.umkm_user?.regionName || "";
      const bucket = ensure(region);
      bucket.totalOrders++;
      bucket.totalValue += o.grand_total ?? o.total_amount ?? 0;
      if (o.distance_km > 0) bucket._distances.push(o.distance_km);
    }

    const regions = Array.from(regionMap.values()).map(r => {
      const avg = r._distances.length
        ? Math.round((r._distances.reduce((a: number, b: number) => a + b, 0) / r._distances.length) * 10) / 10
        : 0;
      const total = r.farmers + r.umkm;
      // Skor kepadatan: gabungan volume transaksi & jumlah mitra
      const density = Math.min(100, Math.round(r.totalOrders * 12 + total * 8));
      return {
        regionName: r.regionName,
        farmers: r.farmers,
        umkm: r.umkm,
        totalPartners: total,
        totalOrders: r.totalOrders,
        totalValue: r.totalValue,
        avgDistanceKm: avg,
        densityScore: density,
        balance: r.farmers > r.umkm ? "SURPLUS_PETANI" : r.umkm > r.farmers ? "DEFISIT_PETANI" : "SEIMBANG",
        centerLat: r.points ? r.latSum / r.points : null,
        centerLng: r.points ? r.lngSum / r.points : null,
        inRadius100Km: avg > 0 ? avg <= 100 : true,
      };
    });

    regions.sort((a, b) => b.densityScore - a.densityScore);

    return res.json({
      success: true,
      totalRegions: regions.length,
      summary: {
        totalFarmers: users.filter(u => u.role === "PETANI").length,
        totalUmkm: users.filter(u => u.role === "UMKM").length,
        avgDistanceKm: regions.length
          ? Math.round((regions.reduce((a, r) => a + r.avgDistanceKm, 0) / regions.length) * 10) / 10
          : 0,
      },
      data: regions,
      points: users.map(u => ({
        id: u.id, name: u.name, role: u.role,
        latitude: u.latitude, longitude: u.longitude,
        regionName: u.regionName, is_active: u.is_active,
        mapsUrl: `https://www.google.com/maps?q=${u.latitude},${u.longitude}`,
      })),
    });
  } catch (error) {
    console.error("[ADMIN] getGeoRadar error:", error);
    return res.status(500).json({ success: false, message: "Gagal memuat radar geospasial." });
  }
}
