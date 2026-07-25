import { db } from "@/lib/db"
import { json, error, requireAdmin } from "@/lib/api-helpers"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth) return error("Admin access required", 403)
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { name, description } = body as { name?: string; description?: string }
  const data: Record<string, string | null> = {}
  if (name) data.name = name
  if (description !== undefined) data.description = description || null
  const dept = await db.department.update({ where: { id }, data })
  return json({ department: dept })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth) return error("Admin access required", 403)
  const { id } = await params
  await db.department.delete({ where: { id } })
  return json({ ok: true })
}
