import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";

const COOKIE = "sv_admin";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", config.sessionSecret)
    .update(payload)
    .digest("hex");
}

export function createSessionCookie(username: string): string {
  const exp = Date.now() + MAX_AGE_MS;
  const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

export function parseSessionCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      u: string;
      exp: number;
    };
    if (!data.u || data.exp < Date.now()) return null;
    return data.u;
  } catch {
    return null;
  }
}

function sessionCookieOptions(req: Request): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  maxAge: number;
  path: string;
} {
  const forwarded = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const secure = req.secure || forwarded === "https";
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: MAX_AGE_MS,
    path: "/",
  };
}

export function setSessionCookie(
  res: Response,
  req: Request,
  username: string,
): void {
  res.cookie(COOKIE, createSessionCookie(username), sessionCookieOptions(req));
}

export function clearSessionCookie(res: Response, req: Request): void {
  const { httpOnly, sameSite, secure, path } = sessionCookieOptions(req);
  res.clearCookie(COOKIE, { httpOnly, sameSite, secure, path });
}

export function getSessionUser(req: Request): string | null {
  const raw = req.cookies?.[COOKIE] as string | undefined;
  return parseSessionCookie(raw);
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "admin login required" });
    return;
  }
  next();
}

export function verifyAdminLogin(
  username: string,
  password: string,
): boolean {
  return (
    username === config.adminUsername &&
    password === config.adminPassword
  );
}
