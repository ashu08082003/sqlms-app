import { db } from "@/lib/db"
import { json, error, requireAdmin } from "@/lib/api-helpers"
import { parseResponses } from "@/lib/constants"
import { sendConsolidatedReportEmail, type ConsolidatedReportData } from "@/lib/email"

/**
 * POST /api/reports/email
 * Body: { locationId, period, year, month, week?, to }
 * Builds the consolidated report and emails it (with PDF attachment).
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)

  const body = await req.json().catch(() => ({}))
  const { locationId, period, year, month, week, to } = body as {
    locationId?: string
    period?: string
    year?: number
    month?: number
    week?: number
    to?: string
  }

  if (!locationId) return error("Location is required", 400)
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) return error("A valid recipient email is required", 400)

  // Build the consolidated data (same logic as the consolidated route)
  const location = await db.location.findUnique({
    where: { id: locationId },
    include: { category: true, department: true, checklist: true },
  })
  if (!location) return error("Location not found", 404)

  const now = new Date()
  const yr = year || now.getFullYear()
  const mo = month || now.getMonth() + 1

  let start: Date
  let end: Date
  let periodLabel: string

  if (period === "week") {
    if (week) {
      start = new Date(yr, 0, 1 + (week - 1) * 7)
      while (start.getDay() !== 1) start.setDate(start.getDate() - 1)
    } else {
      start = new Date(now)
      const dow = start.getDay()
      const diff = dow === 0 ? -6 : 1 - dow
      start.setDate(start.getDate() + diff)
      start.setHours(0, 0, 0, 0)
    }
    end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    periodLabel = `Week of ${start.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}`
  } else {
    start = new Date(yr, mo - 1, 1, 0, 0, 0, 0)
    end = new Date(yr, mo, 0, 23, 59, 59, 999)
    periodLabel = start.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" })
  }

  const inspections = await db.inspection.findMany({
    where: { locationId, inspectionDate: { gte: start, lte: end } },
    orderBy: { inspectionDate: "asc" },
    include: { user: true },
  })

  // checklist items
  let checklistItems: string[] = []
  if (location.checklist) {
    try {
      const parsed = JSON.parse(location.checklist.items)
      if (Array.isArray(parsed)) checklistItems = parsed.map(String)
    } catch {
      checklistItems = []
    }
  }
  if (checklistItems.length === 0 && inspections.length > 0) {
    checklistItems = parseResponses(inspections[0].responses).map((r) => r.item)
  }

  // days
  const days: Date[] = []
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const endCursor = new Date(end)
  endCursor.setHours(0, 0, 0, 0)
  while (cursor <= endCursor) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  // inspection by day
  const inspectionByDay = new Map<
    string,
    { responses: { item: string; status: "OK" | "NOT_OK" | "NA"; reason?: string }[]; userName: string; remarks: string | null }
  >()
  for (const insp of inspections) {
    const d = new Date(insp.inspectionDate)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    inspectionByDay.set(key, {
      responses: parseResponses(insp.responses),
      userName: insp.user.name,
      remarks: insp.remarks,
    })
  }

  const matrix = checklistItems.map((item) => ({
    item,
    days: days.map((day) => {
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`
      const insp = inspectionByDay.get(key)
      if (!insp) return { date: day.toISOString(), status: null as const, reason: null }
      const resp = insp.responses.find((r) => r.item === item)
      return { date: day.toISOString(), status: resp ? resp.status : (null as const), reason: resp?.reason || null }
    }),
  }))

  const totalDays = days.length
  const inspectedDays = inspectionByDay.size
  const completionRate = totalDays === 0 ? 0 : Math.round((inspectedDays / totalDays) * 1000) / 10
  const totalPassed = inspections.reduce((s, i) => s + i.passedCount, 0)
  const totalFailed = inspections.reduce((s, i) => s + i.failedCount, 0)
  const totalNa = inspections.reduce((s, i) => s + i.naCount, 0)
  const avgScore =
    inspections.length === 0
      ? 0
      : Math.round((inspections.reduce((s, i) => s + i.score, 0) / inspections.length) * 10) / 10

  const failures: { date: string; item: string; reason: string; userName: string }[] = []
  for (const [key, insp] of inspectionByDay) {
    for (const r of insp.responses) {
      if (r.status === "NOT_OK") {
        const d = new Date(key)
        failures.push({
          date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }),
          item: r.item,
          reason: r.reason || "No reason provided",
          userName: insp.userName,
        })
      }
    }
  }

  const data: ConsolidatedReportData = {
    location: {
      qrCode: location.qrCode,
      name: location.name,
      machineName: location.machineName,
      categoryName: location.category.name,
      categoryColor: location.category.color,
      departmentName: location.department?.name ?? null,
      frequency: location.frequency,
    },
    checklist: { name: location.checklist?.name ?? null, items: checklistItems },
    period: { type: period || "month", label: periodLabel, start: start.toISOString(), end: end.toISOString() },
    days: days.map((d) => ({
      date: d.toISOString(),
      label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }),
      weekday: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }),
    })),
    matrix,
    summary: {
      totalDays,
      inspectedDays,
      missedDays: totalDays - inspectedDays,
      completionRate,
      totalPassed,
      totalFailed,
      totalNa,
      avgScore,
      inspectionCount: inspections.length,
    },
    failures,
  }

  const result = await sendConsolidatedReportEmail(to, data)
  return json(result)
}
