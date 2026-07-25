import { db } from "@/lib/db"
import { json, error, requireAdmin } from "@/lib/api-helpers"

export async function GET() {
  const depts = await db.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, locations: true } } },
  })
  return json({
    departments: depts.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      userCount: d._count.users,
      locationCount: d._count.locations,
    })),
  })
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)
  const body = await req.json().catch(() => ({}))
  const { name, description } = body as { name?: string; description?: string }
  if (!name) return error("Name is required", 400)
  const exists = await db.department.findUnique({ where: { name } })
  if (exists) return error("Department already exists", 400)
  const dept = await db.department.create({
    data: { name: String(name), description: description || null },
  })
  return json({ department: dept })
}
