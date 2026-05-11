import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const TransactionCreateSchema = z.object({
  assetId: z.string().min(1),
  transactionType: z.enum(["buy", "sell"]).default("buy"),
  date: z.string().min(1), // ISO
  price: z.number().positive(),
  quantity: z.number().positive(),
  fee: z.number().nonnegative().default(0),
  currency: z.enum(["USD", "KRW"]),
  memo: z.string().max(500).optional(),
});

export async function GET() {
  const transactions = await prisma.transaction.findMany({
    include: { asset: true },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ transactions });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = TransactionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const tx = await prisma.transaction.create({
    data: {
      assetId: parsed.data.assetId,
      transactionType: parsed.data.transactionType,
      date: new Date(parsed.data.date),
      price: String(parsed.data.price),
      quantity: String(parsed.data.quantity),
      fee: String(parsed.data.fee),
      currency: parsed.data.currency,
      memo: parsed.data.memo,
    },
    include: { asset: true },
  });
  return NextResponse.json({ transaction: tx }, { status: 201 });
}

