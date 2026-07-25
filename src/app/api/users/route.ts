import { db } from "@/lib/db"
import { hashPassword } from "@/lib/auth"
import { json, error, requireAdmin } from "@/lib/api-helpers"

export async function GET() {
  const auth = await requireAdmin()
  if (!auth) return error("Admin access required", 403)
  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    include: { department: true, _count: { select: { inspections: true } } },
  })
  return json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      employeeCode: u.employeeCode,
      phone: u.phone,
      departmentId: u.departmentId,
      departmentName: u.department?.name ?? null,
      active: u.active,
      inspectionCount: u._count.inspections,
      createdAt: u.createdAt,
    })),
  })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth) return error("Admin access required", 403)
  const body = await req.json().catch(() => ({}))
  const { name, email, password, role, employeeCode, phone, departmentId } = body as {
    name?: string
    email?: string
    password?: string
    role?: string
    employeeCode?: string
    phone?: string
    departmentId?: string
  }
  if (!name || !email || !password) return error("Name, email and password are required", 400)
  const normalizedEmail = String(email).toLowerCase().trim()
  const exists = await db.user.findUnique({ where: { email: normalizedEmail } })
  if (exists) return error("Email already in use", 400)
  const user = await db.user.create({
    data: {
      name: String(name),
      email: normalizedEmail,
      passwordHash: hashPassword(String(password)),
      role: role === "ADMIN" ? "ADMIN" : "EMPLOYEE",
      employeeCode: employeeCode || null,
      phone: phone || null,
      departmentId: departmentId || null,
    },
    include: { department: true },
  })
  return json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      employeeCode: user.employeeCode,
      phone: user.phone,
      departmentId: user.departmentId,
      departmentName: user.department?.name ?? null,
      active: user.active,
    },
  })
}
