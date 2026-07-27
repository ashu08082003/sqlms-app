import { db } from "@/lib/db"
import { json, error, requireAdmin } from "@/lib/api-helpers"
import { parseResponses } from "@/lib/constants"

/**
 * GET /api/reports/consolidated?locationId=X&period=week|month&year=2026&month=7
 *
 * Returns a matrix of checklist items × days for the chosen period,
 * merging all daily inspections for a location into one consolidated view.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)

  const url = new URL(req.url)
  const locationId = url.searchParams.get("locationId")
  const period = url.searchParams.get("period") || "month" // week | month
  const yearStr = url.searchParams.get("year")
  const monthStr = url.searchParams.get("month") // 1-12
  const weekStr = url.searchParams.get("week") // 1-53 (ISO week)

  if (!locationId) return error("Location is required", 400)

  const location = await db.location.findUnique({
    where: { id: locationId },
    include: { category: true, department: true, checklist: true },
  })
  if (!location) return error("Location not found", 404)

  // Determine the date range
  const now = new Date()
  const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear()
  const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1

  let start: Date
  let end: Date
  let periodLabel: string

  if (period === "week") {
    if (weekStr) {
      // ISO week calculation
      const week = parseInt(weekStr, 10)
      const jan1 = new Date(year, 0, 1)
      const dayOffset = (week - 1) * 7
      start = new Date(jan1)
      start.setDate(jan1.getDate() + dayOffset - jan1.getDay() + 1)
      if (jan1.getDay() === 0) start.setDate(start.getDate() - 6)
      start = new Date(year, 0, 1 + (week - 1) * 7)
      // Find the Monday of that week
      while (start.getDay() !== 1) start.setDate(start.getDate() - 1)
    } else {
      // Current week (Monday - Sunday)
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
    // month
    start = new Date(year, month - 1, 1, 0, 0, 0, 0)
    end = new Date(year, month, 0, 23, 59, 59, 999)
    periodLabel = start.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" })
  }

  // Fetch all inspections for this location in the period
  const inspections = await db.inspection.findMany({
    where: {
      locationId,
      inspectionDate: { gte: start, lte: end },
    },
    orderBy: { inspectionDate: "asc" },
    include: { user: true },
  })

  // Build a map: day-of-period -> inspection
  const days: Date[] = []
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const endCursor = new Date(end)
  endCursor.setHours(0, 0, 0, 0)
  while (cursor <= endCursor) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  // checklist items (from the location's checklist, or derive from inspection responses)
  let checklistItems: string[] = []
  if (location.checklist) {
    checklistItems = parseResponses // not used
    // parse items field
    try {
      const parsed = JSON.parse(location.checklist.items)
      if (Array.isArray(parsed)) checklistItems = parsed.map(String)
    } catch {
      checklistItems = []
    }
  }
  // Fallback: derive items from the first inspection's responses
  if (checklistItems.length === 0 && inspections.length > 0) {
    const firstResponses = parseResponses(inspections[0].responses)
    checklistItems = firstResponses.map((r) => r.item)
  }

  // Build day map keyed by YYYY-MM-DD
  const inspectionByDay = new Map<
    string,
    {
      id: string
      date: Date
      responses: { item: string; status: "OK" | "NOT_OK" | "NA"; reason?: string }[]
      passedCount: number
      failedCount: number
      naCount: number
      score: number
      userName: string
      remarks: string | null
    }
  >()

  for (const insp of inspections) {
    const d = new Date(insp.inspectionDate)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    inspectionByDay.set(key, {
      id: insp.id,
      date: d,
      responses: parseResponses(insp.responses),
      passedCount: insp.passedCount,
      failedCount: insp.failedCount,
      naCount: insp.naCount,
      score: insp.score,
      userName: insp.user.name,
      remarks: insp.remarks,
    })
  }

  // Build the matrix: for each item, status per day
  const matrix = checklistItems.map((item) => {
    const dayStatuses = days.map((day) => {
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`
      const insp = inspectionByDay.get(key)
      if (!insp) return { date: day, status: null as null | "OK" | "NOT_OK" | "NA", reason: null, inspectionId: null }
      const resp = insp.responses.find((r) => r.item === item)
      return {
        date: day,
        status: resp ? resp.status : (null as null | "OK" | "NOT_OK" | "NA"),
        reason: resp?.reason || null,
        inspectionId: insp.id,
      }
    })
    return { item, days: dayStatuses }
  })

  // Summary stats
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

  // Collect all failures (item + day + reason)
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

  return json({
    location: {
      id: location.id,
      qrCode: location.qrCode,
      name: location.name,
      machineName: location.machineName,
      categoryName: location.category.name,
      categoryColor: location.category.color,
      departmentName: location.department?.name ?? null,
      frequency: location.frequency,
    },
    checklist: location.checklist
      ? { id: location.checklist.id, name: location.checklist.name, items: checklistItems }
      : { id: null, name: null, items: checklistItems },
    period: {
      type: period,
      label: periodLabel,
      start: start.toISOString(),
      end: end.toISOString(),
      year,
      month,
    },
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
    inspections: inspections.map((i) => ({
      id: i.id,
      date: i.inspectionDate.toISOString(),
      score: i.score,
      passedCount: i.passedCount,
      failedCount: i.failedCount,
      naCount: i.naCount,
      userName: i.user.name,
      remarks: i.remarks,
    })),
  })
}
