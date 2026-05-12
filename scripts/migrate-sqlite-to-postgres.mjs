import "dotenv/config";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const SOURCE_SQLITE_PATH = process.env.SOURCE_SQLITE_PATH ?? "dev.db";
const TARGET_DATABASE_URL = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL;
const isDryRun = process.argv.includes("--dry-run");

const tables = [
  "Asset",
  "Transaction",
  "PriceSnapshot",
  "ExchangeRate",
  "PortfolioSnapshot",
];

function readTable(db, table) {
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);

  if (!exists) return [];
  return db.prepare(`SELECT * FROM "${table}"`).all();
}

function toDate(value, fieldName) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date in ${fieldName}: ${value}`);
  }
  return date;
}

function toDecimalString(value) {
  return String(value ?? 0);
}

function assertTargetDatabaseUrl() {
  if (!TARGET_DATABASE_URL) {
    throw new Error(
      "TARGET_DATABASE_URL 또는 DATABASE_URL이 필요합니다. Neon/Vercel의 Postgres 연결 문자열을 넣어주세요.",
    );
  }

  if (TARGET_DATABASE_URL.startsWith("file:")) {
    throw new Error(
      "현재 DATABASE_URL이 SQLite(file:)입니다. TARGET_DATABASE_URL에 Neon Postgres 주소를 넣고 다시 실행하세요.",
    );
  }
}

async function main() {
  if (!existsSync(SOURCE_SQLITE_PATH)) {
    throw new Error(`SQLite 파일을 찾을 수 없습니다: ${SOURCE_SQLITE_PATH}`);
  }

  const sqlite = new DatabaseSync(SOURCE_SQLITE_PATH, { readOnly: true });
  const data = Object.fromEntries(tables.map((table) => [table, readTable(sqlite, table)]));
  sqlite.close();

  console.log("SQLite source:", SOURCE_SQLITE_PATH);
  for (const table of tables) {
    console.log(`${table}: ${data[table].length}`);
  }

  if (isDryRun) {
    console.log("Dry run complete. Postgres에는 아직 아무것도 쓰지 않았습니다.");
    return;
  }

  assertTargetDatabaseUrl();

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: TARGET_DATABASE_URL }),
  });

  const assetIdMap = new Map();

  try {
    for (const asset of data.Asset) {
      const migrated = await prisma.asset.upsert({
        where: { symbol: String(asset.symbol) },
        update: {
          name: String(asset.name),
          assetType: asset.assetType,
          currency: asset.currency,
        },
        create: {
          id: String(asset.id),
          symbol: String(asset.symbol),
          name: String(asset.name),
          assetType: asset.assetType,
          currency: asset.currency,
          createdAt: toDate(asset.createdAt, "Asset.createdAt"),
          updatedAt: toDate(asset.updatedAt, "Asset.updatedAt"),
        },
      });
      assetIdMap.set(String(asset.id), migrated.id);
    }

    for (const tx of data.Transaction) {
      const assetId = assetIdMap.get(String(tx.assetId));
      if (!assetId) throw new Error(`Missing asset for transaction ${tx.id}`);

      await prisma.transaction.upsert({
        where: { id: String(tx.id) },
        update: {
          assetId,
          transactionType: tx.transactionType,
          date: toDate(tx.date, "Transaction.date"),
          price: toDecimalString(tx.price),
          quantity: toDecimalString(tx.quantity),
          fee: toDecimalString(tx.fee),
          currency: tx.currency,
          memo: tx.memo === null ? null : String(tx.memo),
        },
        create: {
          id: String(tx.id),
          assetId,
          transactionType: tx.transactionType,
          date: toDate(tx.date, "Transaction.date"),
          price: toDecimalString(tx.price),
          quantity: toDecimalString(tx.quantity),
          fee: toDecimalString(tx.fee),
          currency: tx.currency,
          memo: tx.memo === null ? null : String(tx.memo),
          createdAt: toDate(tx.createdAt, "Transaction.createdAt"),
          updatedAt: toDate(tx.updatedAt, "Transaction.updatedAt"),
        },
      });
    }

    for (const snapshot of data.PriceSnapshot) {
      const assetId = assetIdMap.get(String(snapshot.assetId));
      if (!assetId) throw new Error(`Missing asset for price snapshot ${snapshot.id}`);

      await prisma.priceSnapshot.upsert({
        where: { id: String(snapshot.id) },
        update: {
          assetId,
          price: toDecimalString(snapshot.price),
          currency: snapshot.currency,
          source: snapshot.source,
          timestamp: toDate(snapshot.timestamp, "PriceSnapshot.timestamp"),
        },
        create: {
          id: String(snapshot.id),
          assetId,
          price: toDecimalString(snapshot.price),
          currency: snapshot.currency,
          source: snapshot.source,
          timestamp: toDate(snapshot.timestamp, "PriceSnapshot.timestamp"),
        },
      });
    }

    for (const rate of data.ExchangeRate) {
      await prisma.exchangeRate.upsert({
        where: { id: String(rate.id) },
        update: {
          baseCurrency: rate.baseCurrency,
          quoteCurrency: rate.quoteCurrency,
          rate: toDecimalString(rate.rate),
          timestamp: toDate(rate.timestamp, "ExchangeRate.timestamp"),
        },
        create: {
          id: String(rate.id),
          baseCurrency: rate.baseCurrency,
          quoteCurrency: rate.quoteCurrency,
          rate: toDecimalString(rate.rate),
          timestamp: toDate(rate.timestamp, "ExchangeRate.timestamp"),
        },
      });
    }

    for (const snapshot of data.PortfolioSnapshot) {
      await prisma.portfolioSnapshot.upsert({
        where: { id: String(snapshot.id) },
        update: {
          totalInvested: toDecimalString(snapshot.totalInvested),
          totalValue: toDecimalString(snapshot.totalValue),
          totalPnl: toDecimalString(snapshot.totalPnl),
          totalReturnRate: toDecimalString(snapshot.totalReturnRate),
          timestamp: toDate(snapshot.timestamp, "PortfolioSnapshot.timestamp"),
        },
        create: {
          id: String(snapshot.id),
          totalInvested: toDecimalString(snapshot.totalInvested),
          totalValue: toDecimalString(snapshot.totalValue),
          totalPnl: toDecimalString(snapshot.totalPnl),
          totalReturnRate: toDecimalString(snapshot.totalReturnRate),
          timestamp: toDate(snapshot.timestamp, "PortfolioSnapshot.timestamp"),
        },
      });
    }

    console.log("Migration complete. SQLite 데이터를 Postgres로 옮겼습니다.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
