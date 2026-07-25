import { db } from "@/lib/db"
import { json, error, requireAdmin } from "@/lib/api-helpers"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)
  const { id } = await params
  const email = await db.emailLog.findUnique({
    where: { id },
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
  if (!email) return error("Email not found", 404)
  return json({
    email: {
      id: email.id,
      to: email.to,
      subject: email.subject,
      bodyHtml: email.bodyHtml,
      status: email.status,
      type: email.type,
      error: email.error,
      createdAt: email.createdAt,
      inspection: email.inspection
        ? {
            id: email.inspection.id,
            locationName: email.inspection.location.name,
            machineName: email.inspection.location.machineName,
            userName: email.inspection.user.name,
          }
        : null,
    },
  })
}
