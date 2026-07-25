import { db } from "@/lib/db"
import { json, error, requireAuth } from "@/lib/api-helpers"
import { parseItems } from "@/lib/constants"

// Resolve a QR code -> location + checklist (for employee scan flow)
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requireAuth()
  if (!auth) return json({ error: "Unauthorized" }, 401)
  const { code } = await params
  const normalized = String(code).trim().toUpperCase()
  const loc = await db.location.findUnique({
    where: { qrCode: normalized },
    include: { category: true, department: true, checklist: { include: { category: true } } },
  })
  if (!loc) return error("QR code not found", 404)
  if (!loc.active) return error("This location is inactive", 400)

  return json({
    location: {
      id: loc.id,
      qrCode: loc.qrCode,
      name: loc.name,
      machineName: loc.machineName,
      frequency: loc.frequency,
      categoryName: loc.category.name,
      categoryColor: loc.category.color,
      categoryIcon: loc.category.icon,
      departmentName: loc.department?.name ?? null,
    },
    checklist: loc.checklist
      ? {
          id: loc.checklist.id,
          name: loc.checklist.name,
          description: loc.checklist.description,
          frequency: loc.checklist.frequency,
          items: parseItems(loc.checklist.items),
        }
      : null,
  })
}
