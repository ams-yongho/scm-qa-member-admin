import { env } from "@/lib/env";
import { PrismaClient } from "./client";

const globalForPrisma = globalThis as unknown as { prismaAudit: PrismaClient };

export const prismaAudit =
  globalForPrisma.prismaAudit ??
  new PrismaClient({
    datasources: { db: { url: env.AUDIT_DATABASE_URL } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaAudit = prismaAudit;
