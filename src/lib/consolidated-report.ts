import { db } from "@/lib/db"
import { parseResponses } from "@/lib/constants"
import type { Frequency } from "@/lib/types"
import { getPeriodBounds } from "@/lib/frequency"

/**
 * Frequency-aware consolidated report builder.
 *
 * The report column granularity adapts to the location's inspection frequency:
 *   DAILY     -> day columns      (a month/week of individual days)
 *   WEEKLY    -> week columns     (each Mon-Sun week in the month)
 *   MONTHLY   -> month columns    (Jan..Dec of the selected year)
 *   QUARTERLY -> quarter columns  (Q1..Q4 of the selected year)
 *
 * Also returns due-info: the last inspection date and the next due period,
 * so users can see exactly when the next inspection is expected.
 */

export type Granularity = "day" | "week" | "month" | "quarter"

export interface ConsolidatedColumn {
  date: string
  label: string
  weekday: string
  start: string
  end: string
}

export interface ConsolidatedData {
  location: {
    id: string
    qrCode: string
    name: string
    machineName: string
    categoryName: string
    categoryColor: string
    departmentName: string | null
    frequency: string
  }
  checklist: { id: string | null; name: string | null; items: string[] }
  period: {
    type: string
    label: string
    start: string
    end: string
    year: number
    month: number
    granularity: Granularity
  }
  days: ConsolidatedColumn[]
  matrix: {
    item: string
    days: { date: string; status: "OK" | "NOT_OK" | "NA" | null; reason: string | null }[]
  }[]
  summary: {
    totalDays: number
    inspectedDays: number
    missedDays: number
    completionRate: number
    totalPassed: number
    totalFailed: number
    totalNa: number
    avgScore: number
    inspectionCount: number
  }
  failures: { date: string; item: string; reason: string; userName: string }[]
  dueInfo: {
    lastInspectionDate: string | null
    lastInspectionLabel: string | null
    nextDueAt: string | null
    nextDueLabel: string | null
  }
}

/* ---------------- column generators ---------------- */

interface RawColumn {
  start: Date
  end: Date
}

function startOfDayD(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function endOfDayD(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}
function getMonday(d: Date): Date {
  const x = startOfDayD(d)
  const dow = x.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  x.setDate(x.getDate() + diff)
  return x
}

function dayColumns(start: Date, end: Date): RawColumn[] {
  const cols: RawColumn[] = []
  const c = startOfDayD(start)
  const last = startOfDayD(end)
  while (c <= last) {
    cols.push({ start: new Date(c), end: endOfDayD(c) })
    c.setDate(c.getDate() + 1)
  }
  return cols
}

function weekColumns(start: Date, end: Date): RawColumn[] {
  const cols: RawColumn[] = []
  let c = getMonday(start)
  const last = endOfDayD(end)
  while (c <= last) {
    const ws = new Date(c)
    const we = endOfDayD(c)
    we.setDate(we.getDate() + 6)
    cols.push({ start: ws, end: we })
    c.setDate(c.getDate() + 7)
  }
  return cols
}

function monthColumnsInYear(year: number): RawColumn[] {
  return Array.from({ length: 12 }, (_, i) => ({
    start: new Date(year, i, 1, 0, 0, 0, 0),
    end: new Date(year, i + 1, 0, 23, 59, 59, 999),
  }))
}

function quarterColumnsInYear(year: number): RawColumn[] {
  return Array.from({ length: 4 }, (_, i) => ({
    start: new Date(year, i * 3, 1, 0, 0, 0, 0),
    end: new Date(year, i * 3 + 3, 0, 23, 59, 59, 999),
  }))
}

function formatColumn(col: RawColumn, granularity: Granularity): ConsolidatedColumn {
  const s = col.start
  if (granularity === "day") {
    return {
      date: s.toISOString(),
      label: s.toLocaleDateString("en-IN", { day: "2-digit" }),
      weekday: s.toLocaleDateString("en-IN", { weekday: "short" }),
      start: col.start.toISOString(),
      end: col.end.toISOString(),
    }
  }
  if (granularity === "week") {
    const e = col.end
    return {
      date: s.toISOString(),
      label: `${s.toLocaleDateString("en-IN", { day: "2-digit" })}–${e.toLocaleDateString("en-IN", { day: "2-digit" })}`,
      weekday: s.toLocaleDateString("en-IN", { month: "short" }),
      start: col.start.toISOString(),
      end: col.end.toISOString(),
    }
  }
  if (granularity === "month") {
    return {
      date: s.toISOString(),
      label: s.toLocaleDateString("en-IN", { month: "short" }),
      weekday: String(s.getFullYear()),
      start: col.start.toISOString(),
      end: col.end.toISOString(),
    }
  }
  const q = Math.floor(s.getMonth() / 3) + 1
  return {
    date: s.toISOString(),
    label: `Q${q}`,
    weekday: String(s.getFullYear()),
    start: col.start.toISOString(),
    end: col.end.toISOString(),
  }
}

function generateColumns(
  frequency: Frequency,
  period: string,
  year: number,
  month: number,
  week?: number
): { granularity: Granularity; columns: RawColumn[]; periodLabel: string } {
  // MONTHLY -> 12 month columns of the year (Jan..Dec)
  if (frequency === "MONTHLY") {
    return {
      granularity: "month",
      columns: monthColumnsInYear(year),
      periodLabel: `Year ${year}`,
    }
  }
  // QUARTERLY -> 4 quarter columns of the year (Q1..Q4)
  if (frequency === "QUARTERLY") {
    return {
      granularity: "quarter",
      columns: quarterColumnsInYear(year),
      periodLabel: `Year ${year}`,
    }
  }
  // WEEKLY -> week columns (single week, or all weeks of the selected month)
  if (frequency === "WEEKLY") {
    if (period === "week") {
      const base = week
        ? new Date(year, 0, 1 + (week - 1) * 7)
        : new Date()
      const ws = getMonday(base)
      const we = endOfDayD(ws)
      we.setDate(we.getDate() + 6)
      return {
        granularity: "week",
        columns: [{ start: ws, end: we }],
        periodLabel: `Week of ${ws.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
      }
    }
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)
    return {
      granularity: "week",
      columns: weekColumns(monthStart, monthEnd),
      periodLabel: monthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    }
  }
  // DAILY -> day columns
  if (period === "week") {
    const base = week
      ? new Date(year, 0, 1 + (week - 1) * 7)
      : new Date()
    const ws = getMonday(base)
    const we = endOfDayD(ws)
    we.setDate(we.getDate() + 6)
    return {
      granularity: "day",
      columns: dayColumns(ws, we),
      periodLabel: `Week of ${ws.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
    }
  }
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)
  return {
    granularity: "day",
    columns: dayColumns(monthStart, monthEnd),
    periodLabel: monthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
  }
}

/* ---------------- main builder ---------------- */

export async function buildConsolidatedReport(params: {
  locationId: string
  period?: string
  year?: number
  month?: number
  week?: number
}): Promise<ConsolidatedData | { error: string; status: number }> {
  const { locationId, period = "month", week } = params
  const now = new Date()
  const year = params.year || now.getFullYear()
  const month = params.month || now.getMonth() + 1

  const location = await db.location.findUnique({
    where: { id: locationId },
    include: { category: true, department: true, checklist: true },
  })
  if (!location) return { error: "Location not found", status: 404 }

  const frequency = (location.frequency || "DAILY") as Frequency
  const { granularity, columns, periodLabel } = generateColumns(
    frequency,
    period,
    year,
    month,
    week
  )

  const start = columns[0].start
  const end = columns[columns.length - 1].end

  const inspections = await db.inspection.findMany({
    where: { locationId, inspectionDate: { gte: start, lte: end } },
    orderBy: { inspectionDate: "asc" },
    include: { user: true },
  })

  // checklist items (from the location's checklist, or derive from first inspection)
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

  type ParsedResp = { item: string; status: "OK" | "NOT_OK" | "NA"; reason?: string }
  interface ColInspection {
    id: string
    date: Date
    responses: ParsedResp[]
    passedCount: number
    failedCount: number
    naCount: number
    score: number
    userName: string
    remarks: string | null
  }

  // Map each inspection to its column index (one inspection per column expected)
  const inspectionByColumn = new Map<number, ColInspection[]>()
  for (const insp of inspections) {
    const d = new Date(insp.inspectionDate)
    const idx = columns.findIndex((c) => d >= c.start && d <= c.end)
    if (idx < 0) continue
    const val: ColInspection = {
      id: insp.id,
      date: d,
      responses: parseResponses(insp.responses),
      passedCount: insp.passedCount,
      failedCount: insp.failedCount,
      naCount: insp.naCount,
      score: insp.score,
      userName: insp.user.name,
      remarks: insp.remarks,
    }
    const arr = inspectionByColumn.get(idx)
    if (arr) arr.push(val)
    else inspectionByColumn.set(idx, [val])
  }

  // Latest inspection per column
  const columnInspections: (ColInspection | null)[] = columns.map((_, idx) => {
    const arr = inspectionByColumn.get(idx)
    if (!arr || arr.length === 0) return null
    return arr[arr.length - 1]
  })

  const matrix = checklistItems.map((item) => ({
    item,
    days: columns.map((col, idx) => {
      const insp = columnInspections[idx]
      if (!insp) {
        return {
          date: col.start.toISOString(),
          status: null as null | "OK" | "NOT_OK" | "NA",
          reason: null as string | null,
        }
      }
      const resp = insp.responses.find((r) => r.item === item)
      return {
        date: col.start.toISOString(),
        status: resp ? resp.status : (null as null | "OK" | "NOT_OK" | "NA"),
        reason: resp?.reason || null,
      }
    }),
  }))

  const totalDays = columns.length
  const inspectedDays = columnInspections.filter(Boolean).length
  const completionRate = totalDays === 0 ? 0 : Math.round((inspectedDays / totalDays) * 1000) / 10
  const totalPassed = inspections.reduce((s, i) => s + i.passedCount, 0)
  const totalFailed = inspections.reduce((s, i) => s + i.failedCount, 0)
  const totalNa = inspections.reduce((s, i) => s + i.naCount, 0)
  const avgScore =
    inspections.length === 0
      ? 0
      : Math.round((inspections.reduce((s, i) => s + i.score, 0) / inspections.length) * 10) / 10

  const failures: { date: string; item: string; reason: string; userName: string }[] = []
  for (const insp of inspections) {
    for (const r of parseResponses(insp.responses)) {
      if (r.status === "NOT_OK") {
        failures.push({
          date: insp.inspectionDate.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            timeZone: "Asia/Kolkata",
          }),
          item: r.item,
          reason: r.reason || "No reason provided",
          userName: insp.user.name,
        })
      }
    }
  }

  // Due info: last inspection date + next due period
  const latestInspection = inspections.length
    ? inspections[inspections.length - 1]
    : null
  let lastInspectionDate: string | null = null
  let lastInspectionLabel: string | null = null
  let nextDueAt: string | null = null
  let nextDueLabel: string | null = null
  if (latestInspection) {
    const ld = new Date(latestInspection.inspectionDate)
    lastInspectionDate = ld.toISOString()
    lastInspectionLabel = ld.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    const bounds = getPeriodBounds(frequency, ld)
    nextDueAt = bounds.nextStart.toISOString()
    nextDueLabel = bounds.nextLabel
  } else {
    const bounds = getPeriodBounds(frequency)
    nextDueAt = bounds.start.toISOString()
    nextDueLabel = bounds.label
  }

  return {
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
      granularity,
    },
    days: columns.map((c) => formatColumn(c, granularity)),
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
    dueInfo: {
      lastInspectionDate,
      lastInspectionLabel,
      nextDueAt,
      nextDueLabel,
    },
  }
}

