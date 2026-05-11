import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const AssetUpdateSchema = z
  .object({
    symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()).optional(),
    name: z.string().min(1).max(100).optional(),
    assetType: z.enum(["crypto", "stock", "etf", "cash"]).optional(),
    currency: z.enum(["USD", "KRW"]).optional(),
  })
  .refine((x) => Object.keys(x).length > 0, { message: "Empty patch" });

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = AssetUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const asset = await prisma.asset.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ asset });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  await prisma.asset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

