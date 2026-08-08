import { db } from "@/lib/db"
import { getEmailConfig } from "@/lib/email"
import type { Frequency } from "@/lib/types"
import type { ConsolidatedReportData } from "@/lib/email"

/**
 * Get the current cumulative period boundaries for a given frequency.
 *
 * Frequency     Period                 cycleKey        cycleLabel
 * --------------------------------------------------------------
 * DAILY         Current calendar month  "2026-07"       "Jul 2026"
 * WEEKLY        Current quarter         "2026-Q2"       "Q2 2026"
 * MONTHLY       Current calendar year   "2026"          "2026"
 * QUARTERLY     Current calendar year   "2026"          "2026"
 *
 * The idea: inspections accumulate across all shorter cycles that
 * fall within the larger period (daily→month, weekly→quarter,
 * monthly→year, quarterly→year). At the *end* of the outer period a
 * consolidated PDF is emailed and the cumulative set resets.
 */

export interface PeriodInfo {
  start: Date
  end: Date
  cycleKey: string
  cycleLabel: string
  frequency: Frequency
}

export function getCumulativePeriod(frequency: Frequency): PeriodInfo {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const quarter = Math.floor(month / 3) + 1

  switch (frequency) {
    case "DAILY": {
      const start = new Date(year, month, 1)
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
      const cycleKey = `${year}-${String(month + 1).padStart(2, "0")}`
      const cycleLabel = start.toLocaleString("default", { month: "short", year: "numeric" })
      return { start, end, cycleKey, cycleLabel, frequency }
    }
    case "WEEKLY": {
      const start = new Date(year, (quarter - 1) * 3, 1)
      const end = new Date(year, quarter * 3, 0, 23, 59, 59, 999)
      const cycleKey = `${year}-Q${quarter}`
      const cycleLabel = `Q${quarter} ${year}`
      return { start, end, cycleKey, cycleLabel, frequency }
    }
    case "MONTHLY":
    case "QUARTERLY":
    default: {
      const start = new Date(year, 0, 1)
      const end = new Date(year, 11, 31, 23, 59, 59, 999)
      const cycleKey = String(year)
      const cycleLabel = String(year)
      return { start, end, cycleKey, cycleLabel, frequency }
    }
  }
}

/**
 * Check if a new period has just started for the given frequency.
 */
export function isNewPeriodStarted(frequency: Frequency): boolean {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const day = now.getDate()

  switch (frequency) {
    case "DAILY":
      return day === 1
    case "WEEKLY":
      return day === 1 && [0, 3, 6, 9].includes(month)
    case "MONTHLY":
    case "QUARTERLY":
      return month === 0 && day === 1
    default:
      return false
  }
}

/**
 * Get the previous completed period for a frequency.
 */
export function getPreviousPeriod(frequency: Frequency): PeriodInfo {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  switch (frequency) {
    case "DAILY": {
      const prevMonth = month === 0 ? 11 : month - 1
      const prevYear = month === 0 ? year - 1 : year
      const start = new Date(prevYear, prevMonth, 1)
      const end = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999)
      const cycleKey = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}`
      const cycleLabel = start.toLocaleString("default", { month: "short", year: "numeric" })
      return { start, end, cycleKey, cycleLabel, frequency }
    }
    case "WEEKLY": {
      const prevQuarter = month < 3 ? 4 : Math.ceil(month / 3) - 1
      const prevYear = prevQuarter === 4 ? year - 1 : year
      const qStartMonth = (prevQuarter - 1) * 3
      const start = new Date(prevYear, qStartMonth, 1)
      const end = new Date(prevYear, qStartMonth + 3, 0, 23, 59, 59, 999)
      const cycleKey = `${prevYear}-Q${prevQuarter}`
      const cycleLabel = `Q${prevQuarter} ${prevYear}`
      return { start, end, cycleKey, cycleLabel, frequency }
    }
    case "MONTHLY":
    case "QUARTERLY":
    default: {
      const prevYear = year - 1
      const start = new Date(prevYear, 0, 1)
      const end = new Date(prevYear, 11, 31, 23, 59, 59, 999)
      const cycleKey = String(prevYear)
      const cycleLabel = String(prevYear)
      return { start, end, cycleKey, cycleLabel, frequency }
    }
  }
}

export interface CumulativeInspectionSummary {
  inspectionCount: number
  totalPassed: number
  totalFailed: number
  totalNa: number
  averageScore: number
  failureRate: number
}

export interface CumulativeInspectionData {
  location: {
    id: string
    name: string
    machineName: string
    qrCode: string
    categoryName: string
    categoryColor: string
    departmentName: string | null
  }
  period: {
    start: Date
    end: Date
    cycleKey: string
    cycleLabel: string
    frequency: Frequency
  }
  inspections: Array<{
    id: string
    inspectionDate: Date
    passedCount: number
    failedCount: number
    naCount: number
    score: number
    status: string
    user: { name: string; employeeCode: string | null }
    responses: Array<{ item: string; status: string; reason?: string }>
  }>
  summary: CumulativeInspectionSummary
}

/**
 * Fetch all inspections for a location within the given cumulative period.
 */
export async function getCumulativeInspectionData(
  locationId: string,
  period: PeriodInfo
): Promise<CumulativeInspectionData | null> {
  const location = await db.location.findUnique({
    where: { id: locationId },
    include: { category: true, department: true },
  })
  if (!location) return null

  const inspections = await db.inspection.findMany({
    where: {
      locationId,
      inspectionDate: { gte: period.start, lte: period.end },
    },
    orderBy: { inspectionDate: "desc" },
    include: { user: true },
  })

  const parsed = inspections.map((i) => ({
    ...i,
    responses: JSON.parse(i.responses || "[]") as Array<{
      item: string
      status: string
      reason?: string
    }>,
  }))

  const totalInspections = parsed.length
  const totalPassed = parsed.reduce((s, i) => s + i.passedCount, 0)
  const totalFailed = parsed.reduce((s, i) => s + i.failedCount, 0)
  const totalNa = parsed.reduce((s, i) => s + i.naCount, 0)
  const avgScore =
    totalInspections > 0
      ? Math.round((parsed.reduce((s, i) => s + i.score, 0) / totalInspections) * 10) / 10
      : 0
  const failureRate =
    totalPassed + totalFailed > 0
      ? Math.round((totalFailed / (totalPassed + totalFailed)) * 1000) / 10
      : 0

  return {
    location: {
      id: location.id,
      name: location.name,
      machineName: location.machineName,
      qrCode: location.qrCode,
      categoryName: location.category.name,
      categoryColor: location.category.color,
      departmentName: location.department?.name ?? null,
    },
    period: {
      start: period.start,
      end: period.end,
      cycleKey: period.cycleKey,
      cycleLabel: period.cycleLabel,
      frequency: period.frequency,
    },
    inspections: parsed.map((i) => ({
      id: i.id,
      inspectionDate: i.inspectionDate,
      passedCount: i.passedCount,
      failedCount: i.failedCount,
      naCount: i.naCount,
      score: i.score,
      status: i.status,
      user: { name: i.user.name, employeeCode: i.user.employeeCode },
      responses: i.responses,
    })),
    summary: {
      inspectionCount: totalInspections,
      totalPassed,
      totalFailed,
      totalNa,
      averageScore: avgScore,
      failureRate,
    },
  }
}

/**
 * Convert CumulativeInspectionData to ConsolidatedReportData format
 * expected by sendConsolidatedReportEmail.
 */
export function toConsolidatedReportData(data: CumulativeInspectionData): ConsolidatedReportData {
  const periodType = data.period.frequency === "WEEKLY" ? "week" : "month"

  const daysMap = new Map<string, { date: string; label: string; weekday: string }>()
  const matrixMap = new Map<string, { item: string; days: { date: string; status: "OK" | "NOT_OK" | "NA" | null; reason: string | null }[] }>()
  const failures: { date: string; item: string; reason: string; userName: string }[] = []

  for (const insp of data.inspections) {
    const dateObj = new Date(insp.inspectionDate)
    const dateKey = dateObj.toISOString().split("T")[0]
    const dayLabel = dateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    const weekday = dateObj.toLocaleDateString("en-IN", { weekday: "short" })
    const dateStr = dateObj.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })

    if (!daysMap.has(dateKey)) {
      daysMap.set(dateKey, { date: dateKey, label: dayLabel, weekday })
    }

    for (const resp of insp.responses) {
      if (!matrixMap.has(resp.item)) {
        matrixMap.set(resp.item, { item: resp.item, days: [] })
      }
      const existing = matrixMap.get(resp.item)!
      existing.days.push({
        date: dateKey,
        status: resp.status as "OK" | "NOT_OK" | "NA",
        reason: resp.reason || null,
      })

      if (resp.status === "NOT_OK") {
        failures.push({
          date: dateStr,
          item: resp.item,
          reason: resp.reason || "No reason provided",
          userName: insp.user.name,
        })
      }
    }
  }

  const days = Array.from(daysMap.values())
  const matrix = Array.from(matrixMap.values())

  const checklistItems = data.inspections.length > 0
    ? data.inspections[0].responses.map((r) => r.item)
    : []

  return {
    location: {
      qrCode: data.location.qrCode,
      name: data.location.name,
      machineName: data.location.machineName,
      categoryName: data.location.categoryName,
      categoryColor: data.location.categoryColor,
      departmentName: data.location.departmentName,
      frequency: data.period.frequency,
    },
    checklist: {
      name: `Checklist for ${data.location.name}`,
      description: null,
      documentNumber: null,
      items: checklistItems,
    },
    period: {
      type: periodType,
      label: data.period.cycleLabel,
      start: data.period.start.toISOString(),
      end: data.period.end.toISOString(),
    },
    days,
    matrix,
    summary: {
      totalDays: days.length,
      inspectedDays: data.summary.inspectionCount,
      missedDays: Math.max(0, days.length - data.summary.inspectionCount),
      completionRate: days.length > 0 ? Math.round((data.summary.inspectionCount / days.length) * 100) : 0,
      totalPassed: data.summary.totalPassed,
      totalFailed: data.summary.totalFailed,
      totalNa: data.summary.totalNa,
      avgScore: data.summary.averageScore,
      inspectionCount: data.summary.inspectionCount,
    },
    failures,
  }
}

/**
 * Process cumulative reports for ALL locations.
 */
export async function processCumulativeReports() {
  const frequencies: Frequency[] = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY"]
  const finalized: string[] = []
  const sent: string[] = []
  const errors: string[] = []

  for (const freq of frequencies) {
    if (!isNewPeriodStarted(freq)) continue

    const prevPeriod = getPreviousPeriod(freq)
    const locations = await db.location.findMany({
      where: { active: true, frequency: freq },
      select: { id: true },
    })

    for (const loc of locations) {
      try {
        const existing = await db.cumulativeReport.findUnique({
          where: {
            locationId_frequency_cycleKey: {
              locationId: loc.id,
              frequency: freq,
              cycleKey: prevPeriod.cycleKey,
            },
          },
        })
        if (existing && (existing.status === "FINALIZED" || existing.status === "SENT")) {
          continue
        }

        const data = await getCumulativeInspectionData(loc.id, prevPeriod)
        if (!data || data.summary.inspectionCount === 0) {
          await db.cumulativeReport.upsert({
            where: {
              locationId_frequency_cycleKey: {
                locationId: loc.id,
                frequency: freq,
                cycleKey: prevPeriod.cycleKey,
              },
            },
            update: { status: "FINALIZED", lastGeneratedAt: new Date() },
            create: {
              locationId: loc.id,
              frequency: freq,
              cycleKey: prevPeriod.cycleKey,
              status: "FINALIZED",
            },
          })
          finalized.push(`${loc.id}:${freq}:${prevPeriod.cycleKey}`)
          continue
        }

        const settings = await getEmailConfig()
        if (settings.enableReportEmail && settings.reportToEmail) {
          const reportData = toConsolidatedReportData(data)
          const { sendConsolidatedReportEmail } = await import("@/lib/email")
          const result = await sendConsolidatedReportEmail(settings.reportToEmail, reportData)
          sent.push(`${loc.id}:${freq}:${prevPeriod.cycleKey} → ${result.status}`)
        }

        await db.cumulativeReport.upsert({
          where: {
            locationId_frequency_cycleKey: {
              locationId: loc.id,
              frequency: freq,
              cycleKey: prevPeriod.cycleKey,
            },
          },
          update: { status: "SENT", lastGeneratedAt: new Date(), lastEmailedAt: new Date() },
          create: {
            locationId: loc.id,
            frequency: freq,
            cycleKey: prevPeriod.cycleKey,
            status: "SENT",
            lastGeneratedAt: new Date(),
            lastEmailedAt: new Date(),
          },
        })

        finalized.push(`${loc.id}:${freq}:${prevPeriod.cycleKey}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${loc.id}:${freq}:${prevPeriod.cycleKey} → ${msg}`)
      }
    }
  }

  return { finalized, sent, errors }
}

/**
 * Called after each inspection is submitted.
 */
export async function onInspectionSubmitted(locationId: string): Promise<void> {
  const frequencies: Frequency[] = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY"]
  const started = frequencies.filter(isNewPeriodStarted)
  if (started.length === 0) return
  await processCumulativeReports()
}
