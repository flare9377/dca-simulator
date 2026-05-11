import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const TransactionUpdateSchema = z
  .object({
    transactionType: z.enum(["buy", "sell"]).optional(),
    date: z.string().min(1).optional(),
    price: z.number().positive().optional(),
    quantity: z.number().positive().optional(),
    fee: z.number().nonnegative().optional(),
    currency: z.enum(["USD", "KRW"]).optional(),
    memo: z.string().max(500).nullable().optional(),
  })
  .refine((x) => Object.keys(x).length > 0, { message: "Empty patch" });

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = TransactionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const tx = await prisma.transaction.update({
    where: { id },
    data: {
      transactionType: parsed.data.transactionType,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
      price: parsed.data.price != null ? String(parsed.data.price) : undefined,
      quantity:
        parsed.data.quantity != null ? String(parsed.data.quantity) : undefined,
      fee: parsed.data.fee != null ? String(parsed.data.fee) : undefined,
      currency: parsed.data.currency,
      memo: parsed.data.memo === null ? null : parsed.data.memo,
    },
    include: { asset: true },
  });

  return NextResponse.json({ transaction: tx });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

