import { json, error, requireAdmin } from "@/lib/api-helpers"
import {
  getCumulativePeriod,
  getCumulativeInspectionData,
  processCumulativeReports,
  isNewPeriodStarted,
} from "@/lib/report-scheduler"
import { sendConsolidatedReportEmail, getEmailConfig } from "@/lib/email"
import type { Frequency } from "@/lib/types"

/**
 * GET /api/reports/cumulative?locationId=X&frequency=DAILY
 * 
 * Returns the current cumulative inspection data for a location.
 * This shows the rolling document (e.g., all daily inspections this month).
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)

  const url = new URL(req.url)
  const locationId = url.searchParams.get("locationId")
  const frequency = (url.searchParams.get("frequency") || "DAILY") as Frequency

  if (!locationId) return error("Location ID is required", 400)

  const period = getCumulativePeriod(frequency)
  const data = await getCumulativeInspectionData(locationId, period)

  if (!data) return error("Location not found", 404)

  return json({
    ...data,
    period: {
      ...data.period,
      cycleLabel: period.cycleLabel,
      cycleKey: period.cycleKey,
      isNewPeriodStarted: isNewPeriodStarted(frequency),
    },
  })
}

/**
 * POST /api/reports/cumulative
 * 
 * Manually trigger processing of cumulative reports.
 * Normally runs automatically after inspections, but admin can trigger it.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)

  const result = await processCumulativeReports()

  return json({
    message: "Cumulative reports processed",
    ...result,
  })
}

/**
 * PUT /api/reports/cumulative
 * 
 * Send the current cumulative report for a specific location via email.
 * Body: { locationId, frequency? }
 */
export async function PUT(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)

  const body = await req.json().catch(() => ({}))
  const { locationId, frequency: rawFreq } = body as {
    locationId?: string
    frequency?: string
  }

  if (!locationId) return error("Location ID is required", 400)

  const frequency = (rawFreq || "DAILY") as Frequency
  const period = getCumulativePeriod(frequency)
  const data = await getCumulativeInspectionData(locationId, period)

  if (!data) return error("Location not found", 404)
  if (data.summary.inspectionCount === 0) {
    return error("No inspections found for the current period", 400)
  }

  const settings = await getEmailConfig()
  const to = settings.reportToEmail || auth.user.email

  const sendResult = await sendConsolidatedReportEmail(to, data)

  return json({
    message:
      sendResult.status === "SENT"
        ? `Report sent to ${to}`
        : sendResult.status === "SIMULATED"
          ? `Report simulated (SMTP not configured), would send to ${to}`
          : `Failed to send: ${sendResult.error}`,
    status: sendResult.status,
    to,
    period: {
      ...data.period,
      cycleLabel: period.cycleLabel,
      cycleKey: period.cycleKey,
    },
  })
}
