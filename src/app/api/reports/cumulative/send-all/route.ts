import { json, requireAdmin } from "@/lib/api-helpers"
import { processCumulativeReports } from "@/lib/report-scheduler"

/**
 * POST /api/reports/cumulative/send-all
 * 
 * Trigger processing and sending of ALL cumulative reports
 * for locations whose period has just ended.
 * 
 * This is the main endpoint that would be called by a cron job.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth) return json({ error: "Admin access required" }, 403)

  const result = await processCumulativeReports()

  return json({
    message:
      result.errors.length > 0
        ? `Processed with ${result.errors.length} error(s)`
        : "All cumulative reports processed successfully",
    finalized: result.finalized,
    sent: result.sent,
    errors: result.errors,
  })
}
