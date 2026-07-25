import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import type { SafeUser } from "@/lib/types"

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function toSafeUser(
  u: Awaited<ReturnType<typeof getSessionUser>>
): SafeUser | null {
  if (!u) return null
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as SafeUser["role"],
    employeeCode: u.employeeCode,
    phone: u.phone,
    departmentId: u.departmentId,
    departmentName: u.department?.name ?? null,
    active: u.active,
  }
}

export async function requireAuth(req?: Request): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>
  safe: SafeUser
} | null> {
  const user = await getSessionUser(req)
  if (!user) return null
  return { user, safe: toSafeUser(user)! }
}

export async function requireAdmin(req?: Request) {
  const auth = await requireAuth(req)
  if (!auth) return null
  if (auth.safe.role !== "ADMIN") return null
  return auth
}
