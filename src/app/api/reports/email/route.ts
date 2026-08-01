import { json, error, requireAdmin } from "@/lib/api-helpers"
import { buildConsolidatedReport } from "@/lib/consolidated-report"
import { sendConsolidatedReportEmail } from "@/lib/email"

/**
 * POST /api/reports/email
 * Body: { locationId, period, year, month, week?, to }
 * Builds the frequency-aware consolidated report and emails it (with PDF attachment).
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

  const result = await buildConsolidatedReport({
    locationId,
    period,
    year,
    month,
    week,
  })

  if ("error" in result) {
    return error(result.error, result.status)
  }

  const data = {
    location: result.location,
    checklist: result.checklist,
    period: result.period,
    days: result.days,
    matrix: result.matrix,
    summary: result.summary,
    failures: result.failures,
  }

  const emailResult = await sendConsolidatedReportEmail(to, data)
  return json(emailResult)
}

