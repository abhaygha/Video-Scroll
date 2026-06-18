import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
  prismaSchemaHash: string | undefined;
};

function getSchemaHash(): string {
  try {
    const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
    const classPath = path.join(
      process.cwd(),
      "src",
      "generated",
      "prisma",
      "internal",
      "class.ts",
    );
    const schema = readFileSync(schemaPath, "utf8");
    let classSrc = "";
    try {
      classSrc = readFileSync(classPath, "utf8");
    } catch {
      // generated client not present yet
    }
    return createHash("md5").update(schema).update(classSrc).digest("hex");
  } catch {
    return "unknown";
  }
}

function createPrismaClient() {
  const pool =
    globalForPrisma.pgPool ??
    new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  const schemaHash = getSchemaHash();
  const stale =
    !globalForPrisma.prisma ||
    globalForPrisma.prismaSchemaHash !== schemaHash;

  if (stale) {
    if (globalForPrisma.prisma) {
      void globalForPrisma.prisma.$disconnect();
    }
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaSchemaHash = schemaHash;
  }

  return globalForPrisma.prisma!;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getPrismaClient();
    const value = client[prop as keyof PrismaClient];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});
