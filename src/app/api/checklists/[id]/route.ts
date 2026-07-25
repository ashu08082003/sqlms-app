import { db } from "@/lib/db"
import { json, error, requireAdmin } from "@/lib/api-helpers"
import { stringifyItems } from "@/lib/constants"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { name, categoryId, frequency, description, items, active } = body as {
    name?: string
    categoryId?: string
    frequency?: string
    description?: string
    items?: string[]
    active?: boolean
  }
  const data: Record<string, unknown> = {}
  if (name) data.name = name
  if (categoryId) data.categoryId = categoryId
  if (frequency) data.frequency = frequency
  if (description !== undefined) data.description = description || null
  if (typeof active === "boolean") data.active = active
  if (Array.isArray(items)) {
    const cleaned = items.map((i) => String(i).trim()).filter(Boolean)
    data.items = stringifyItems(cleaned)
  }
  const cl = await db.checklist.update({ where: { id }, data })
  return json({ checklist: cl })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)
  const { id } = await params
  await db.checklist.delete({ where: { id } })
  return json({ ok: true })
}
