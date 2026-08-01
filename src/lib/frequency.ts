import { db } from "@/lib/db"
import type { Frequency } from "@/lib/types"

/**
 * Frequency-based inspection enforcement.
 *
 * DAILY     → once per calendar day
 * WEEKLY    → once per week (Mon–Sun)  ≈ 4× per month
 * MONTHLY   → once per calendar month
 * QUARTERLY → once per calendar quarter (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec)
 */

export interface PeriodBounds {
  start: Date
  end: Date
  label: string
  nextStart: Date
  nextLabel: string
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  const dow = x.getDay() // 0 = Sun
  const diff = dow === 0 ? -6 : 1 - dow // Monday
  x.setDate(x.getDate() + diff)
  return x
}

export function endOfWeek(d: Date): Date {
  const x = startOfWeek(d)
  x.setDate(x.getDate() + 6)
  return endOfDay(x)
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3)
  return new Date(d.getFullYear(), q * 3, 1, 0, 0, 0, 0)
}

export function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3)
  return new Date(d.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999)
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
}

function fmtQuarter(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1
  return `Q${q} ${d.getFullYear()}`
}

/**
 * Return the boundaries of the period in which `date` falls for a frequency,
 * plus the start of the *next* period and its label.
 */
export function getPeriodBounds(frequency: Frequency, date: Date = new Date()): PeriodBounds {
  switch (frequency) {
    case "DAILY": {
      const start = startOfDay(date)
      const end = endOfDay(date)
      const next = new Date(start)
      next.setDate(next.getDate() + 1)
      return {
        start,
        end,
        label: fmtShort(start),
        nextStart: next,
        nextLabel: fmtShort(next),
      }
    }
    case "WEEKLY": {
      const start = startOfWeek(date)
      const end = endOfWeek(date)
      const next = new Date(start)
      next.setDate(next.getDate() + 7)
      return {
        start,
        end,
        label: `${fmtShort(start)} – ${fmtShort(end)}`,
        nextStart: next,
        nextLabel: `${fmtShort(next)} – ${fmtShort(endOfWeek(next))}`,
      }
    }
    case "MONTHLY": {
      const start = startOfMonth(date)
      const end = endOfMonth(date)
      const next = new Date(start.getFullYear(), start.getMonth() + 1, 1)
      return {
        start,
        end,
        label: fmtMonthYear(start),
        nextStart: next,
        nextLabel: fmtMonthYear(next),
      }
    }
    case "QUARTERLY":
    default: {
      const start = startOfQuarter(date)
      const end = endOfQuarter(date)
      const next = new Date(start.getFullYear(), start.getMonth() + 3, 1)
      return {
        start,
        end,
        label: fmtQuarter(start),
        nextStart: next,
        nextLabel: fmtQuarter(next),
      }
    }
  }
}

/**
 * Check if the location already has a completed inspection in the current
 * period for the given frequency.
 */
export async function hasInspectionInPeriod(
  locationId: string,
  frequency: Frequency,
  now: Date = new Date()
): Promise<boolean> {
  const { start, end } = getPeriodBounds(frequency, now)
  const count = await db.inspection.count({
    where: {
      locationId,
      status: "COMPLETED",
      inspectionDate: { gte: start, lte: end },
    },
  })
  return count > 0
}

/**
 * Get the most recent completed inspection for a location (any period).
 */
export async function getLatestInspection(locationId: string) {
  return db.inspection.findFirst({
    where: { locationId, status: "COMPLETED" },
    orderBy: { inspectionDate: "desc" },
    select: { id: true, inspectionDate: true, score: true },
  })
}

/**
 * Return a friendly status object describing whether the location is
 * due for an inspection right now, plus the current period info.
 */
export async function getInspectionStatus(locationId: string, frequency: Frequency) {
  const bounds = getPeriodBounds(frequency)
  const alreadyInspected = await hasInspectionInPeriod(locationId, frequency)
  const latest = await getLatestInspection(locationId)

  return {
    frequency,
    periodLabel: bounds.label,
    periodStart: bounds.start.toISOString(),
    periodEnd: bounds.end.toISOString(),
    alreadyInspected,
    nextDueAt: alreadyInspected ? bounds.nextStart.toISOString() : null,
    nextDueLabel: alreadyInspected ? bounds.nextLabel : null,
    latestInspection: latest
      ? {
          id: latest.id,
          date: latest.inspectionDate.toISOString(),
          score: latest.score,
        }
      : null,
  }
}

