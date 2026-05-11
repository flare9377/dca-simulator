import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = process.env.DATABASE_URL
  ? new PrismaBetterSqlite3({ url: process.env.DATABASE_URL })
  : null;

if (!adapter) {
  throw new Error("DATABASE_URL is required for seeding (e.g. file:./dev.db).");
}

const prisma = new PrismaClient({ adapter });

async function main() {
  // Assets
  const btc = await prisma.asset.upsert({
    where: { symbol: "BTC" },
    update: {},
    create: { symbol: "BTC", name: "Bitcoin", assetType: "crypto", currency: "USD" },
  });
  const eth = await prisma.asset.upsert({
    where: { symbol: "ETH" },
    update: {},
    create: { symbol: "ETH", name: "Ethereum", assetType: "crypto", currency: "USD" },
  });

  // Transactions (sample DCA)
  const txs = [
    { assetId: btc.id, date: new Date("2025-01-01"), price: "60000", quantity: "0.01" },
    { assetId: btc.id, date: new Date("2025-02-01"), price: "70000", quantity: "0.01" },
    { assetId: btc.id, date: new Date("2025-03-01"), price: "80000", quantity: "0.01" },
    { assetId: eth.id, date: new Date("2025-01-01"), price: "2500", quantity: "0.2" },
    { assetId: eth.id, date: new Date("2025-02-01"), price: "3000", quantity: "0.2" },
    { assetId: eth.id, date: new Date("2025-03-01"), price: "3500", quantity: "0.2" },
  ] as const;

  for (const t of txs) {
    await prisma.transaction.create({
      data: {
        assetId: t.assetId,
        transactionType: "buy",
        date: t.date,
        price: t.price,
        quantity: t.quantity,
        fee: "0",
        currency: "USD",
        memo: "seed",
      },
    });
  }

  // Last known prices (so the app works even if API fails)
  await prisma.priceSnapshot.create({
    data: { assetId: btc.id, price: "90000", currency: "USD", source: "manual", timestamp: new Date() },
  });
  await prisma.priceSnapshot.create({
    data: { assetId: eth.id, price: "4000", currency: "USD", source: "manual", timestamp: new Date() },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

