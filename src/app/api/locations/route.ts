import { db } from "@/lib/db"
import { json, error, requireAdmin, requireAuth } from "@/lib/api-helpers"
import { formatQrCode } from "@/lib/constants"

export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if (!auth) return json({ error: "Unauthorized" }, 401)
  const locs = await db.location.findMany({
    orderBy: { qrCode: "asc" },
    include: {
      category: true,
      department: true,
      checklist: true,
      _count: { select: { inspections: true } },
    },
  })
  return json({
    locations: locs.map((l) => ({
      id: l.id,
      qrCode: l.qrCode,
      name: l.name,
      machineName: l.machineName,
      frequency: l.frequency,
      active: l.active,
      categoryId: l.categoryId,
      categoryName: l.category.name,
      categoryColor: l.category.color,
      categoryIcon: l.category.icon,
      departmentId: l.departmentId,
      departmentName: l.department?.name ?? null,
      checklistId: l.checklistId,
      checklistName: l.checklist?.name ?? null,
      inspectionCount: l._count.inspections,
      createdAt: l.createdAt,
    })),
  })
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)
  const body = await req.json().catch(() => ({}))
  const {
    name,
    machineName,
    categoryId,
    departmentId,
    checklistId,
    frequency,
  } = body as {
    name?: string
    machineName?: string
    categoryId?: string
    departmentId?: string
    checklistId?: string
    frequency?: string
  }
  if (!name || !machineName || !categoryId) {
    return error("Location name, machine name and category are required", 400)
  }

  // Auto-generate next QR code: QR000xxx based on count
  const count = await db.location.count()
  const qrCode = formatQrCode(count + 1)
  // Guard against collision
  const existing = await db.location.findUnique({ where: { qrCode } })
  if (existing) {
    // fall back to max numeric
    const all = await db.location.findMany({ select: { qrCode: true } })
    const maxNum = all.reduce((m, l) => {
      const n = parseInt(l.qrCode.replace(/\D/g, ""), 10)
      return isNaN(n) ? m : Math.max(m, n)
    }, 0)
    const loc = await db.location.create({
      data: {
        qrCode: formatQrCode(maxNum + 1),
        name: String(name),
        machineName: String(machineName),
        categoryId: String(categoryId),
        departmentId: departmentId || null,
        checklistId: checklistId || null,
        frequency: frequency || "DAILY",
      },
      include: { category: true, department: true, checklist: true },
    })
    return json({ location: loc })
  }

  const loc = await db.location.create({
    data: {
      qrCode,
      name: String(name),
      machineName: String(machineName),
      categoryId: String(categoryId),
      departmentId: departmentId || null,
      checklistId: checklistId || null,
      frequency: frequency || "DAILY",
    },
    include: { category: true, department: true, checklist: true },
  })
  return json({ location: loc })
}
