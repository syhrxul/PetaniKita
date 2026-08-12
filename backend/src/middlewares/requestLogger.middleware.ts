import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

export function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const ip = req.ip || req.socket.remoteAddress || "-";
    const logMsg = `[HTTP] ${req.method} ${req.originalUrl || req.url} | Status: ${statusCode} | Duration: ${duration}ms | IP: ${ip}`;

    if (statusCode >= 500) {
      logger.error(logMsg);
    } else if (statusCode >= 400) {
      logger.warn(logMsg);
    } else {
      logger.info(logMsg);
    }
  });

  next();
}
