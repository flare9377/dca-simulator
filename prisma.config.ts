import "dotenv/config";
import { defineConfig } from "prisma/config";

const migrationUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error("DATABASE_URL or DATABASE_URL_UNPOOLED is required for Prisma.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: migrationUrl,
  },
});
