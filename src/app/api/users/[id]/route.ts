import { db } from "@/lib/db"
import { hashPassword } from "@/lib/auth"
import { json, error, requireAdmin } from "@/lib/api-helpers"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { name, email, password, role, employeeCode, phone, departmentId, active } = body as {
    name?: string
    email?: string
    password?: string
    role?: string
    employeeCode?: string
    phone?: string
    departmentId?: string
    active?: boolean
  }
  const data: Record<string, unknown> = {}
  if (name) data.name = name
  if (email) data.email = String(email).toLowerCase().trim()
  if (password) data.passwordHash = hashPassword(String(password))
  if (role) data.role = role === "ADMIN" ? "ADMIN" : "EMPLOYEE"
  if (employeeCode !== undefined) data.employeeCode = employeeCode || null
  if (phone !== undefined) data.phone = phone || null
  if (departmentId !== undefined) data.departmentId = departmentId || null
  if (typeof active === "boolean") data.active = active
  const user = await db.user.update({ where: { id }, data })
  return json({ user: { id: user.id } })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)
  const { id } = await params
  // Prevent deleting the last admin
  const target = await db.user.findUnique({ where: { id } })
  if (target?.role === "ADMIN") {
    const adminCount = await db.user.count({ where: { role: "ADMIN" } })
    if (adminCount <= 1) return error("Cannot delete the last admin account", 400)
  }
  await db.user.delete({ where: { id } })
  return json({ ok: true })
}
