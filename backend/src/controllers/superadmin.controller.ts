import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { logActivity } from "../services/auditLog.service.js";
import { waEngineState, waLogsStore } from "../services/whatsappBot.service.js";
import { analyzePriceProposalAI } from "../services/price_decision_ai.service.js";
import { runDynamicMultiSourcePriceScraper } from "../services/cronPriceScraper.service.js";

// ============================================================
// MODULE 1: Audit Logs
// ============================================================
export async function getAuditLogs(_req: any, res: any) {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    console.error("[SUPERADMIN] Audit Logs Error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengambil audit log." });
  }
}

// ============================================================
// MODULE 2: User Management
// ============================================================
export async function getUsersManagement(_req: any, res: any) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        username: true,
        name: true,
        phone_number: true,
        waLid: true,
        role: true,
        registrationCode: true,
        regionName: true,
        is_active: true,
        created_at: true,
      },
    });
    return res.json({ success: true, total: users.length, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal mengambil data user." });
  }
}

export async function resetUserPassword(req: any, res: any) {
  try {
    const { userId, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password min 6 karakter!" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: Number(userId) }, data: { password: hashedPassword } });
    return res.json({ success: true, message: "Password berhasil diubah!" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal mereset password." });
  }
}

export async function promoteUserRole(req: any, res: any) {
  try {
    const { userId, role } = req.body;
    if (!["PETANI", "UMKM", "SUPERADMIN"].includes(role)) {
      return res.status(400).json({ success: false, message: "Role tidak valid." });
    }
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) return res.status(404).json({ success: false, message: "User tidak ditemukan." });
    await prisma.user.update({ where: { id: Number(userId) }, data: { role } });
    return res.json({ success: true, message: `Role ${user.username} diubah menjadi ${role}!` });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal mengubah role." });
  }
}

export async function deleteUserAccount(req: any, res: any) {
  try {
    const { userId } = req.body;
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) return res.status(404).json({ success: false, message: "User tidak ditemukan." });
    if (user.role === "SUPERADMIN") {
      return res.status(403).json({ success: false, message: "Tidak dapat menghapus SUPERADMIN." });
    }
    // Delete related data
    await prisma.umkmOrder.deleteMany({ where: { umkm_user_id: Number(userId) } });
    await prisma.harvestEvent.deleteMany({ where: { crop: { user_id: Number(userId) } } });
    await prisma.farmCrop.deleteMany({ where: { user_id: Number(userId) } });
    await prisma.user.delete({ where: { id: Number(userId) } });
    return res.json({ success: true, message: `User ${user.username} berhasil dihapus!` });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal menghapus user." });
  }
}

// ============================================================
// MODULE 3: Regional Prices & Commodities
// ============================================================
export async function getRegionalPricesAndCommodities(_req: any, res: any) {
  try {
    const prices = await prisma.priceHistory.findMany({ orderBy: { regionName: "asc" } });
    const commodities = await prisma.harvestEvent.findMany({
      where: { status: "AVAILABLE" },
      include: { crop: { include: { user: true } } },
      orderBy: { uploaded_at: "desc" },
    });
    return res.json({
      success: true,
      data: {
        prices: prices.map((p: any) => ({
          id: p.id,
          region: p.regionName,
          commodity: p.commodity,
          farmerPrice: p.farmer_price,
          hapPrice: p.hap_price,
          trend: p.trend,
        })),
        commodities: commodities.map((c: any) => ({
          id: c.id,
          commodityName: c.crop?.crop_type,
          yieldKg: c.est_yield_kg,
          pricePerKg: c.price_per_kg,
          farmerName: c.crop?.user?.name,
          regionName: c.crop?.user?.regionName,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal mengambil data harga." });
  }
}

// ============================================================
// MODULE 4: Geospatial Radar
// ============================================================
export async function getGeospatialRadarData(_req: any, res: any) {
  try {
    const users = await prisma.user.findMany({
      where: { AND: [{ latitude: { not: null } }, { longitude: { not: null } }] },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        phone_number: true,
        regionName: true,
        latitude: true,
        longitude: true,
      },
    });
    return res.json({ success: true, total: users.length, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal mengambil data geospasial." });
  }
}

// ============================================================
// MODULE 5: WA Engine Control
// ============================================================
export async function getWaEngineStatus(_req: any, res: any) {
  return res.json({
    success: true,
    engine: {
      status: waEngineState.status,
      qrCodeBase64: waEngineState.qrCodeBase64,
      sendDelaySeconds: waEngineState.sendDelaySeconds,
      enableTypingEffect: waEngineState.enableTypingEffect,
      botPhone: waEngineState.botPhone,
    },
    logs: waLogsStore.slice(0, 50),
  });
}

export async function updateWaSettings(req: any, res: any) {
  try {
    const { sendDelaySeconds, enableTypingEffect } = req.body;
    if (sendDelaySeconds !== undefined) {
      waEngineState.sendDelaySeconds = Math.max(0, Math.min(60, Number(sendDelaySeconds)));
    }
    if (enableTypingEffect !== undefined) {
      waEngineState.enableTypingEffect = Boolean(enableTypingEffect);
    }
    return res.json({
      success: true,
      message: "Pengaturan WA Engine diperbarui!",
      data: {
        sendDelaySeconds: waEngineState.sendDelaySeconds,
        enableTypingEffect: waEngineState.enableTypingEffect,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal update konfigurasi." });
  }
}

export async function getWaLogs(_req: any, res: any) {
  return res.json({
    success: true,
    config: {
      sendDelaySeconds: waEngineState.sendDelaySeconds,
      enableTypingEffect: waEngineState.enableTypingEffect,
    },
    logs: waLogsStore.slice(0, 50),
  });
}

export async function sendBroadcast(req: any, res: any) {
  try {
    const { targetRole, message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: "Pesan wajib diisi!" });

    const where: any = { is_active: true };
    if (targetRole === "FARMER") where.role = "PETANI";
    else if (targetRole === "UMKM") where.role = "UMKM";

    const recipients = await prisma.user.findMany({ where, select: { phone_number: true, name: true } });

    if (recipients.length === 0) {
      return res.json({ success: false, message: "Tidak ada penerima." });
    }

    // Send in background with delays
    const { getSocket } = await import("../services/whatsapp.service.js");
    const { sendHumanLikeWaMessage } = await import("../services/whatsappBot.service.js");
    const sock = getSocket();

    let sent = 0;
    for (const recipient of recipients) {
      try {
        const success = await sendHumanLikeWaMessage(sock, recipient.phone_number, message, "BROADCAST");
        if (success) sent++;
        // Add extra delay between recipients
        await new Promise((r) => setTimeout(r, 1500));
      } catch {
        // continue
      }
    }

    return res.json({
      success: true,
      message: `Broadcast selesai: ${sent}/${recipients.length} terkirim.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal kirim broadcast." });
  }
}

// ============================================================
// MODULE 6: Price Proposals with AI Analysis (per group)
// ============================================================
export async function getPriceProposalsGrouped(_req: any, res: any) {
  try {
    const pending = await prisma.priceProposal.findMany({
      where: { status: "PENDING" },
      include: { user: { select: { id: true, name: true, phone_number: true, regionName: true } } },
      orderBy: { created_at: "desc" },
    });

    // Group by regionName + commodity
    const groupMap = new Map<string, {
      regionName: string;
      commodity: string;
      proposals: typeof pending;
      currentPrice: number;
    }>();

    for (const p of pending) {
      const key = `${p.regionName}||${p.commodity}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, { regionName: p.regionName, commodity: p.commodity, proposals: [], currentPrice: 0 });
      }
      groupMap.get(key)!.proposals.push(p);
    }

    // Attach current price from PriceHistory for each group
    for (const [key, group] of groupMap) {
      const record = await prisma.priceHistory.findUnique({
        where: { regionName_commodity: { regionName: group.regionName, commodity: group.commodity } },
      });
      group.currentPrice = record?.farmer_price ?? 0;
    }

    // Run AI analysis for each group (parallel, max 5 concurrent)
    const groups = Array.from(groupMap.values());
    const results = await Promise.all(
      groups.map(async (g) => {
        const prices = g.proposals.map((p) => p.proposed_price);
        const avgPrice = Math.round(prices.reduce((s, v) => s + v, 0) / prices.length);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const reasons = g.proposals.map((p) => p.reason).filter(Boolean) as string[];

        let aiAnalysis = null;
        try {
          aiAnalysis = await analyzePriceProposalAI(
            g.regionName,
            g.commodity,
            g.currentPrice,
            g.proposals.length,
            avgPrice,
            reasons
          );
        } catch {
          aiAnalysis = null;
        }

        return {
          regionName: g.regionName,
          commodity: g.commodity,
          currentPrice: g.currentPrice,
          totalProposals: g.proposals.length,
          avgProposedPrice: avgPrice,
          minProposedPrice: minPrice,
          maxProposedPrice: maxPrice,
          reasons,
          aiAnalysis,
          proposals: g.proposals.map((p) => ({
            id: p.id,
            proposedPrice: p.proposed_price,
            reason: p.reason,
            status: p.status,
            createdAt: p.created_at,
            farmerName: p.user.name,
            farmerPhone: p.user.phone_number,
            farmerRegion: p.user.regionName,
          })),
        };
      })
    );

    return res.json({ success: true, totalGroups: results.length, data: results });
  } catch (error) {
    console.error("[SUPERADMIN] Price Proposals Error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengambil data proposal harga." });
  }
}

export async function approveOrRejectProposalGroup(req: any, res: any) {
  try {
    const { regionName, commodity, action, overridePrice } = req.body;
    if (!["APPROVE", "REJECT"].includes(action)) {
      return res.status(400).json({ success: false, message: "action harus APPROVE atau REJECT" });
    }

    if (action === "APPROVE" && overridePrice) {
      const newPrice = Number(overridePrice);
      const current = await prisma.priceHistory.findUnique({
        where: { regionName_commodity: { regionName, commodity } },
      });
      const prevPrice = current?.farmer_price ?? newPrice;
      const trend = newPrice > prevPrice ? "UP" : newPrice < prevPrice ? "DOWN" : "STABLE";

      await prisma.priceHistory.upsert({
        where: { regionName_commodity: { regionName, commodity } },
        update: {
          farmer_price: newPrice,
          prev_price: prevPrice,
          umkm_price: Math.round(newPrice * 1.2),
          hap_price: Math.round(newPrice * 1.15),
          trend,
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
        },
      });
    }

    await prisma.priceProposal.updateMany({
      where: { regionName, commodity, status: "PENDING" },
      data: { status: action === "APPROVE" ? "APPROVED" : "REJECTED" },
    });

    return res.json({
      success: true,
      message: `Semua proposal ${commodity} di ${regionName} telah di-${action === "APPROVE" ? "setujui" : "tolak"}.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal memproses proposal." });
  }
}

// ============================================================
// MANUAL MULTI-SOURCE REALTIME PRICE SCRAPER TRIGGER
// ============================================================
export async function triggerManualScrape(req: any, res: any) {
  try {
    // Jalankan scraper di background (tidak memblokir response)
    runDynamicMultiSourcePriceScraper();

    logActivity({
      actorName: "Superadmin",
      role: "SUPERADMIN",
      action: "PRICE_REALTIME_SCRAPE_TRIGGERED",
      module: "PRICE_ENGINE",
      description: `Superadmin memicu Multi-Source Realtime Price Scraping manual untuk seluruh daerah terdaftar.`,
      ipAddress: req?.ip,
      userAgent: req?.headers?.["user-agent"],
    });

    return res.status(200).json({
      success: true,
      message: "Proses Multi-Source Realtime Price Scraping telah dipicu di latar belakang!",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Gagal memicu scraping manual." });
  }
}
