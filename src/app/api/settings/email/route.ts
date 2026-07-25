import { json, error, requireAdmin } from "@/lib/api-helpers"
import { getEmailConfig, updateEmailConfig, sendTestEmail } from "@/lib/email"

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)
  const config = await getEmailConfig()
  // Never echo the password back to the client; return a flag instead.
  return json({
    config: {
      ...config,
      smtpPass: "",
      hasSmtpPass: config.smtpPass !== "",
    },
  })
}

export async function PUT(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)
  const body = await req.json().catch(() => ({}))
  const {
    reportToEmail,
    escalationToEmail,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    fromEmail,
    fromName,
    enableReportEmail,
    enableEscalation,
    simulateOnly,
  } = body as Record<string, unknown>

  const patch: Record<string, unknown> = {}
  if (typeof reportToEmail === "string") patch.reportToEmail = reportToEmail.trim()
  if (typeof escalationToEmail === "string") patch.escalationToEmail = escalationToEmail.trim()
  if (typeof smtpHost === "string") patch.smtpHost = smtpHost.trim()
  if (typeof smtpPort === "number") patch.smtpPort = smtpPort
  if (typeof smtpUser === "string") patch.smtpUser = smtpUser.trim()
  // Only update password if a non-empty string is sent (don't wipe on empty)
  if (typeof smtpPass === "string" && smtpPass !== "") patch.smtpPass = smtpPass
  if (typeof fromEmail === "string") patch.fromEmail = fromEmail.trim()
  if (typeof fromName === "string") patch.fromName = fromName.trim()
  if (typeof enableReportEmail === "boolean") patch.enableReportEmail = enableReportEmail
  if (typeof enableEscalation === "boolean") patch.enableEscalation = enableEscalation
  if (typeof simulateOnly === "boolean") patch.simulateOnly = simulateOnly

  const config = await updateEmailConfig(patch)
  return json({
    config: {
      ...config,
      smtpPass: "",
      hasSmtpPass: config.smtpPass !== "",
    },
  })
}

// Send a test email
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth) return error("Admin access required", 403)
  const body = await req.json().catch(() => ({}))
  const { to } = body as { to?: string }
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) return error("A valid email is required", 400)
  const result = await sendTestEmail(to.trim())
  return json(result)
}
