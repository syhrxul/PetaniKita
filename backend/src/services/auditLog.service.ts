import { prisma } from "../lib/prisma.js";
import { logger } from "../utils/logger.js";

export type AuditModule =
  | "AUTH"
  | "HARVEST"
  | "ORDER"
  | "LOCATION"
  | "PRICE_ENGINE"
  | "ADMIN"
  | "SYSTEM";

interface LogParams {
  userId?: string | number;
  role?: string;
  action: string;
  method: string;
  path: string;
  statusCode?: number;
  details?: any;
  ipAddress?: string;
}

interface ActivityParams {
  userId?: string | number | null;
  actorPhone?: string | null;
  actorName?: string | null;
  role?: string | null;
  action: string;
  module: AuditModule;
  description: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Engine Audit Log terpusat (Fire-and-Forget).
 * Dipakai oleh Bot WhatsApp, Controller API, dan Panel Superadmin.
 * TIDAK pernah memblokir / melempar error ke alur utama.
 */
export function logActivity(params: ActivityParams): void {
  const userIdStr =
    params.userId !== undefined && params.userId !== null ? String(params.userId) : null;

  logger.info(
    {
      action: params.action,
      module: params.module,
      actor: params.actorName || userIdStr || "System",
    },
    `[AUDIT/${params.module}] ${params.action} — ${params.description}`
  );

  prisma.auditLog
    .create({
      data: {
        userId: userIdStr,
        role: params.role || null,
        actorPhone: params.actorPhone || null,
        actorName: params.actorName || "System",
        action: params.action,
        module: params.module,
        description: params.description,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    })
    .catch((err: Error) => {
      console.error("❌ Failed to write audit log:", err.message);
    });
}

/**
 * Versi async (await-able) bila pemanggil butuh kepastian tulis.
 */
export async function logActivityAsync(params: ActivityParams): Promise<void> {
  try {
    const userIdStr =
      params.userId !== undefined && params.userId !== null ? String(params.userId) : null;

    await prisma.auditLog.create({
      data: {
        userId: userIdStr,
        role: params.role || null,
        actorPhone: params.actorPhone || null,
        actorName: params.actorName || "System",
        action: params.action,
        module: params.module,
        description: params.description,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (error) {
    console.error("❌ Failed to write audit log:", error);
  }
}

/**
 * Mencatat Audit Log HTTP ke MariaDB secara Asinkron (Fire-and-Forget)
 * TIDAK memblokir alur balik (res.json) API!
 */
export function recordAuditLog(params: LogParams) {
  const userIdStr =
    params.userId !== undefined && params.userId !== null ? String(params.userId) : undefined;

  // Console logging terstruktur via Pino
  logger.info(
    {
      action: params.action,
      user: userIdStr || "GUEST",
      path: `${params.method} ${params.path}`,
      status: params.statusCode,
    },
    `[AUDIT] ${params.action} executed by ${userIdStr || "GUEST"}`
  );

  // Async write ke MariaDB
  prisma.auditLog
    .create({
      data: {
        userId: userIdStr || null,
        role: params.role || null,
        action: params.action,
        module: inferModuleFromPath(params.path),
        description: buildDescription(params),
        method: params.method,
        path: params.path,
        statusCode: params.statusCode || 200,
        details:
          typeof params.details === "object"
            ? JSON.stringify(params.details)
            : String(params.details || ""),
        ipAddress: params.ipAddress || null,
      },
    })
    .catch((err: Error) => {
      logger.error(`❌ Failed to save AuditLog to DB: ${err.message}`);
    });
}

function inferModuleFromPath(path: string): AuditModule {
  if (path.includes("/auth")) return "AUTH";
  if (path.includes("/harvest")) return "HARVEST";
  if (path.includes("/location")) return "LOCATION";
  if (path.includes("/prices")) return "PRICE_ENGINE";
  if (path.includes("/admin")) return "ADMIN";
  if (path.includes("/order") || path.includes("/procurement") || path.includes("negotiat"))
    return "ORDER";
  return "SYSTEM";
}

function buildDescription(params: LogParams): string {
  const detail =
    typeof params.details === "object" && params.details !== null
      ? Object.entries(params.details)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
      : String(params.details ?? "");
  return `${params.action} via ${params.method} ${params.path}${detail ? ` — ${detail}` : ""}`;
}
