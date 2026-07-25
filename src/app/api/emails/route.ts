import { db } from "@/lib/db"
import { json, error, requireAdmin } from "@/lib/api-helpers"

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)
  const url = new URL(req.url)
  const type = url.searchParams.get("type") // REPORT | ESCALATION
  const status = url.searchParams.get("status") // SENT | FAILED | SIMULATED

  const where: Record<string, unknown> = {}
  if (type) where.type = type
  if (status) where.status = status

  const logs = await db.emailLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      inspection: {
        select: {
          id: true,
          location: { select: { name: true, machineName: true } },
          user: { select: { name: true } },
        },
      },
    },
  })

  return json({
    emails: logs.map((e) => ({
      id: e.id,
      to: e.to,
      subject: e.subject,
      status: e.status,
      type: e.type,
      error: e.error,
      createdAt: e.createdAt,
      inspection: e.inspection
        ? {
            id: e.inspection.id,
            locationName: e.inspection.location.name,
            machineName: e.inspection.location.machineName,
            userName: e.inspection.user.name,
          }
        : null,
    })),
  })
}
