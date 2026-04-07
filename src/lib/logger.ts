/**
 * Structured logger that persists to the system_logs table.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("drip-processor", "Enrollment processed", { enrollmentId: "..." });
 *   logger.error("whatsapp-api", "Send failed", { phone, error: result.error });
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

async function writeLog(entry: LogEntry) {
  // Always write to console too (for Vercel function logs as backup)
  const consoleFn = entry.level === "error" ? console.error
    : entry.level === "warn" ? console.warn
    : console.log;
  consoleFn(`[${entry.source}] ${entry.message}`, entry.metadata ?? "");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("system_logs").insert({
      level: entry.level,
      source: entry.source,
      message: entry.message,
      metadata: entry.metadata ?? null,
    });
  } catch {
    // Don't let logging failures break the app
    console.error("[Logger] Failed to write log to DB");
  }
}

export const logger = {
  debug: (source: string, message: string, metadata?: Record<string, unknown>) =>
    writeLog({ level: "debug", source, message, metadata }),
  info: (source: string, message: string, metadata?: Record<string, unknown>) =>
    writeLog({ level: "info", source, message, metadata }),
  warn: (source: string, message: string, metadata?: Record<string, unknown>) =>
    writeLog({ level: "warn", source, message, metadata }),
  error: (source: string, message: string, metadata?: Record<string, unknown>) =>
    writeLog({ level: "error", source, message, metadata }),
};
