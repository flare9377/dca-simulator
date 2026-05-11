-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('crypto', 'stock', 'etf', 'cash');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('buy', 'sell');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'KRW');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('coingecko', 'manual', 'last_known');

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "currency" "Currency" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "transactionType" "TransactionType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "currency" "Currency" NOT NULL,
    "source" "PriceSource" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "baseCurrency" "Currency" NOT NULL,
    "quoteCurrency" "Currency" NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "totalInvested" DECIMAL(65,30) NOT NULL,
    "totalValue" DECIMAL(65,30) NOT NULL,
    "totalPnl" DECIMAL(65,30) NOT NULL,
    "totalReturnRate" DECIMAL(65,30) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_symbol_key" ON "Asset"("symbol");

-- CreateIndex
CREATE INDEX "Asset_assetType_idx" ON "Asset"("assetType");

-- CreateIndex
CREATE INDEX "Transaction_assetId_date_idx" ON "Transaction"("assetId", "date");

-- CreateIndex
CREATE INDEX "PriceSnapshot_assetId_timestamp_idx" ON "PriceSnapshot"("assetId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_baseCurrency_quoteCurrency_timestamp_key" ON "ExchangeRate"("baseCurrency", "quoteCurrency", "timestamp");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_timestamp_idx" ON "PortfolioSnapshot"("timestamp");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
