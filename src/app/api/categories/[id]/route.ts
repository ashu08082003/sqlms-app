import { db } from "@/lib/db"
import { json, error, requireAdmin } from "@/lib/api-helpers"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { name, icon, color, description } = body as Record<string, string | undefined>
  const data: Record<string, string | null> = {}
  if (name) {
    data.name = name
    data.slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  }
  if (icon) data.icon = icon
  if (color) data.color = color
  if (description !== undefined) data.description = description || null
  const cat = await db.category.update({ where: { id }, data })
  return json({ category: cat })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)
  const { id } = await params
  await db.category.delete({ where: { id } })
  return json({ ok: true })
}
