import { db } from "@/lib/db"
import { json, error, requireAdmin } from "@/lib/api-helpers"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth) return error("Admin access required", 403)
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { name, machineName, categoryId, departmentId, checklistId, frequency, active } = body as {
    name?: string
    machineName?: string
    categoryId?: string
    departmentId?: string
    checklistId?: string
    frequency?: string
    active?: boolean
  }
  const data: Record<string, unknown> = {}
  if (name) data.name = name
  if (machineName) data.machineName = machineName
  if (categoryId) data.categoryId = categoryId
  if (departmentId !== undefined) data.departmentId = departmentId || null
  if (checklistId !== undefined) data.checklistId = checklistId || null
  if (frequency) data.frequency = frequency
  if (typeof active === "boolean") data.active = active
  const loc = await db.location.update({ where: { id }, data })
  return json({ location: loc })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth) return error("Admin access required", 403)
  const { id } = await params
  await db.location.delete({ where: { id } })
  return json({ ok: true })
}
