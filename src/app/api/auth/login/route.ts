import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session";

function redirectToLogin(req: Request, next: string) {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", "1");
  url.searchParams.set("next", next);
  return NextResponse.redirect(url, { status: 303 });
}

function normalizeNext(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const password = String(formData.get("password") ?? "");
  const nextValue = String(formData.get("next") ?? "/");
  const next = normalizeNext(nextValue);
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json({ error: "ADMIN_PASSWORD is not configured." }, { status: 500 });
  }

  if (password !== adminPassword) {
    return redirectToLogin(req, next);
  }

  const token = await createSessionToken();
  const res = NextResponse.redirect(new URL(next, req.url), { status: 303 });
  res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return res;
}
