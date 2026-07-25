import { db } from "@/lib/db"
import { json, error, requireAdmin } from "@/lib/api-helpers"

export async function GET() {
  const cats = await db.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { locations: true, checklists: true } } },
  })
  return json({
    categories: cats.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      color: c.color,
      description: c.description,
      locationCount: c._count.locations,
      checklistCount: c._count.checklists,
    })),
  })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth) return error("Admin access required", 403)
  const body = await req.json().catch(() => ({}))
  const { name, icon, color, description } = body as {
    name?: string
    icon?: string
    color?: string
    description?: string
  }
  if (!name) return error("Name is required", 400)
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const exists = await db.category.findUnique({ where: { slug } })
  if (exists) return error("Category with this name already exists", 400)
  const cat = await db.category.create({
    data: {
      name: String(name),
      slug,
      icon: icon || "Tag",
      color: color || "#0d9488",
      description: description || null,
    },
  })
  return json({ category: cat })
}
