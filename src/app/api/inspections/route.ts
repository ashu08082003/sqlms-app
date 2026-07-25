import { db } from "@/lib/db"
import { json, error, requireAuth } from "@/lib/api-helpers"
import { stringifyResponses } from "@/lib/constants"
import type { ItemStatus } from "@/lib/types"

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (!auth) return json({ error: "Unauthorized" }, 401)
  const url = new URL(req.url)
  const categoryId = url.searchParams.get("categoryId")
  const locationId = url.searchParams.get("locationId")
  const departmentId = url.searchParams.get("departmentId")
  const userId = url.searchParams.get("userId")
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")
  const search = url.searchParams.get("search")?.trim()

  const where: Record<string, unknown> = {}
  if (locationId) where.locationId = locationId
  if (userId) where.userId = userId
  if (categoryId) where.location = { categoryId }
  if (departmentId) where.location = { ...(where.location as object), departmentId }
  if (from || to) {
    const range: Record<string, Date> = {}
    if (from) range.gte = new Date(from)
    if (to) {
      const tEnd = new Date(to)
      tEnd.setHours(23, 59, 59, 999)
      range.lte = tEnd
    }
    where.inspectionDate = range
  }
  if (search) {
    where.OR = [
      { location: { name: { contains: search } } },
      { location: { machineName: { contains: search } } },
      { location: { qrCode: { contains: search } } },
      { user: { name: { contains: search } } },
      { remarks: { contains: search } },
    ]
  }

  const inspections = await db.inspection.findMany({
    where,
    orderBy: { inspectionDate: "desc" },
    take: 500,
    include: {
      location: { include: { category: true, department: true } },
      user: true,
      checklist: true,
    },
  })

  return json({
    inspections: inspections.map((i) => ({
      id: i.id,
      inspectionDate: i.inspectionDate,
      status: i.status,
      passedCount: i.passedCount,
      failedCount: i.failedCount,
      naCount: i.naCount,
      score: i.score,
      remarks: i.remarks,
      photoUrl: i.photoUrl,
      location: {
        id: i.location.id,
        qrCode: i.location.qrCode,
        name: i.location.name,
        machineName: i.location.machineName,
        categoryName: i.location.category.name,
        categoryColor: i.location.category.color,
        departmentName: i.location.department?.name ?? null,
      },
      user: { id: i.user.id, name: i.user.name, employeeCode: i.user.employeeCode },
      checklist: i.checklist ? { id: i.checklist.id, name: i.checklist.name } : null,
    })),
  })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (!auth) return json({ error: "Unauthorized" }, 401)

  const body = await req.json().catch(() => ({}))
  const { locationId, responses, remarks, photoUrl } = body as {
    locationId?: string
    responses?: { item: string; status: ItemStatus; reason?: string; photoUrl?: string }[]
    remarks?: string
    photoUrl?: string
  }

  if (!locationId) return error("Location is required", 400)
  if (!Array.isArray(responses) || responses.length === 0)
    return error("Checklist responses are required", 400)

  const location = await db.location.findUnique({
    where: { id: locationId },
    include: { checklist: true, category: true },
  })
  if (!location) return error("Location not found", 404)

  const passed = responses.filter((r) => r.status === "OK").length
  const failed = responses.filter((r) => r.status === "NOT_OK").length
  const na = responses.filter((r) => r.status === "NA").length
  const denom = passed + failed
  const score = denom === 0 ? 100 : Math.round((passed / denom) * 1000) / 10

  const inspection = await db.inspection.create({
    data: {
      locationId,
      userId: auth.user.id,
      checklistId: location.checklistId,
      responses: stringifyResponses(responses),
      remarks: remarks || null,
      photoUrl: photoUrl || null,
      passedCount: passed,
      failedCount: failed,
      naCount: na,
      score,
      status: "COMPLETED",
    },
    include: {
      location: { include: { category: true, department: true } },
      user: true,
      checklist: true,
    },
  })

  return json({
    inspection: {
      id: inspection.id,
      inspectionDate: inspection.inspectionDate,
      passedCount: inspection.passedCount,
      failedCount: inspection.failedCount,
      naCount: inspection.naCount,
      score: inspection.score,
      location: {
        name: inspection.location.name,
        machineName: inspection.location.machineName,
        categoryName: inspection.location.category.name,
      },
      user: { name: inspection.user.name },
    },
  })
}
