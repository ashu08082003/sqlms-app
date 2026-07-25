import { db } from "@/lib/db"
import { json, error, requireAuth } from "@/lib/api-helpers"
import { parseResponses } from "@/lib/constants"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth) return json({ error: "Unauthorized" }, 401)
  const { id } = await params
  const inspection = await db.inspection.findUnique({
    where: { id },
    include: {
      location: { include: { category: true, department: true } },
      user: true,
      checklist: true,
    },
  })
  if (!inspection) return error("Inspection not found", 404)

  return json({
    inspection: {
      id: inspection.id,
      inspectionDate: inspection.inspectionDate,
      status: inspection.status,
      passedCount: inspection.passedCount,
      failedCount: inspection.failedCount,
      naCount: inspection.naCount,
      score: inspection.score,
      remarks: inspection.remarks,
      photoUrl: inspection.photoUrl,
      responses: parseResponses(inspection.responses),
      location: {
        id: inspection.location.id,
        qrCode: inspection.location.qrCode,
        name: inspection.location.name,
        machineName: inspection.location.machineName,
        categoryName: inspection.location.category.name,
        categoryColor: inspection.location.category.color,
        departmentName: inspection.location.department?.name ?? null,
      },
      user: {
        id: inspection.user.id,
        name: inspection.user.name,
        employeeCode: inspection.user.employeeCode,
      },
      checklist: inspection.checklist
        ? { id: inspection.checklist.id, name: inspection.checklist.name }
        : null,
    },
  })
}
