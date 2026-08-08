import { db } from "@/lib/db"
import { json, error, requireAdmin } from "@/lib/api-helpers"
import { parseItems, stringifyItems } from "@/lib/constants"

export async function GET() {
  const cls = await db.checklist.findMany({
    orderBy: { name: "asc" },
    include: { category: true, _count: { select: { locations: true } } },
  })
  return json({
    checklists: cls.map((c) => ({
      id: c.id,
      name: c.name,
      documentNumber: c.documentNumber,
      description: c.description,
      frequency: c.frequency,
      items: parseItems(c.items),
      active: c.active,
      categoryId: c.categoryId,
      categoryName: c.category.name,
      categoryColor: c.category.color,
      locationCount: c._count.locations,
    })),
  })
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)
  const body = await req.json().catch(() => ({}))
  const { name, documentNumber, categoryId, frequency, description, items } = body as {
    name?: string
    documentNumber?: string
    categoryId?: string
    frequency?: string
    description?: string
    items?: string[]
  }
  if (!name || !categoryId) return error("Name and category are required", 400)
  const itemList = Array.isArray(items) ? items.filter((i) => String(i).trim()) : []
  if (itemList.length === 0) return error("At least one checklist item is required", 400)
  const cl = await db.checklist.create({
    data: {
      name: String(name),
      documentNumber: documentNumber?.trim() || null,
      categoryId: String(categoryId),
      frequency: frequency || "DAILY",
      description: description || null,
      items: stringifyItems(itemList.map((i) => String(i).trim())),
    },
    include: { category: true },
  })
  return json({ checklist: cl })
}
