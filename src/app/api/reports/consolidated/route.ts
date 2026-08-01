import { json, error, requireAdmin } from "@/lib/api-helpers"
import { buildConsolidatedReport } from "@/lib/consolidated-report"

/**
 * GET /api/reports/consolidated?locationId=X&period=week|month&year=2026&month=7
 *
 * Frequency-aware consolidated report:
 *   DAILY     -> day columns      (a month/week of individual days)
 *   WEEKLY    -> week columns     (each Mon-Sun week in the month)
 *   MONTHLY   -> month columns    (Jan..Dec of the selected year)
 *   QUARTERLY -> quarter columns  (Q1..Q4 of the selected year)
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

  const result = await buildConsolidatedReport({
    locationId,
    period,
    year: yearStr ? parseInt(yearStr, 10) : undefined,
    month: monthStr ? parseInt(monthStr, 10) : undefined,
    week: weekStr ? parseInt(weekStr, 10) : undefined,
  })

  if ("error" in result) {
    return error(result.error, result.status)
  }

  return json(result)
}

