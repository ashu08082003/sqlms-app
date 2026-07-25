import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto"
import { cookies } from "next/headers"
import { db } from "@/lib/db"

const SESSION_COOKIE = "sqlms_session"
const SECRET = process.env.AUTH_SECRET || "sqlms-dev-secret-change-me"

/* ---------------- Password hashing (scrypt) ---------------- */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const hashBuf = Buffer.from(hash, "hex")
  const testBuf = scryptSync(password, salt, 64)
  if (hashBuf.length !== testBuf.length) return false
  return timingSafeEqual(hashBuf, testBuf)
}

/* ---------------- Signed token (used for both cookie & bearer) ---------------- */
function sign(payload: string): string {
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex")
  return `${payload}.${sig}`
}

function verify(token: string): string | null {
  const idx = token.lastIndexOf(".")
  if (idx === -1) return null
  const payload = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expected = createHmac("sha256", SECRET).update(payload).digest("hex")
  if (sig.length !== expected.length) return null
  try {
    if (timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return payload
  } catch {
    return null
  }
  return null
}

/** Create a signed session token for a user id. */
export function createSessionToken(userId: string): string {
  return sign(userId)
}

export async function setSession(userId: string): Promise<string> {
  const token = sign(userId)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
  return token
}

export async function clearSession() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

/**
 * Resolve the current session user.
 *
 * Reads the session token from EITHER:
 *   1. the `Authorization: Bearer <token>` header (primary — works through
 *      gateways / cross-site iframes where SameSite cookies are blocked), OR
 *   2. the `sqlms_session` httpOnly cookie (fallback for first-party contexts).
 */
export async function getSessionUser(req?: Request) {
  try {
    let token: string | undefined

    // 1. Bearer token from Authorization header
    if (req) {
      const auth = req.headers.get("authorization") || req.headers.get("Authorization")
      if (auth && auth.toLowerCase().startsWith("bearer ")) {
        token = auth.slice(7).trim()
      }
    }

    // 2. Fall back to cookie
    if (!token) {
      const store = await cookies()
      token = store.get(SESSION_COOKIE)?.value
    }

    if (!token) return null
    const userId = verify(token)
    if (!userId) return null
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { department: true },
    })
    if (!user || !user.active) return null
    return user
  } catch {
    return null
  }
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>
