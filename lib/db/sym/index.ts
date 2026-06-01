import { env } from "@/lib/env";
import { PrismaClient } from "./client";

const globalForPrisma = globalThis as unknown as { prismaSym: PrismaClient };

export const prismaSym =
  globalForPrisma.prismaSym ??
  new PrismaClient({
    datasources: { db: { url: env.SYM_DATABASE_URL } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaSym = prismaSym;
