import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const AssetCreateSchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  name: z.string().min(1).max(100),
  assetType: z.enum(["crypto", "stock", "etf", "cash"]),
  currency: z.enum(["USD", "KRW"]),
});

export async function GET() {
  const assets = await prisma.asset.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ assets });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = AssetCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const asset = await prisma.asset.create({ data: parsed.data });
  return NextResponse.json({ asset }, { status: 201 });
}

