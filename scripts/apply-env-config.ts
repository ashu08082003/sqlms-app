/**
 * Applies SMTP / email configuration from environment variables into the database.
 * This runs on every container start so that Railway-deployed instances
 * automatically get live email capability without needing to re-enter
 * SMTP credentials through the admin UI each time.
 *
 * Supported env vars (all optional):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, FROM_NAME
 *   REPORT_TO_EMAIL, ESCALATION_TO_EMAIL
 *   ENABLE_REPORT_EMAIL, ENABLE_ESCALATION, SIMULATE_ONLY
 *
 * Any env var that is set will be written to the EmailSetting "global" row.
 */
import { PrismaClient } from "@prisma/client"

const p = new PrismaClient()

function boolEnv(name: string): boolean | undefined {
  const v = process.env[name]
  if (v === undefined || v === "") return undefined
  return v.toLowerCase() === "true" || v === "1"
}

async function main() {
  const hasAny =
    process.env.SMTP_HOST ||
    process.env.SMTP_USER ||
    process.env.SMTP_PASS ||
    process.env.FROM_EMAIL ||
    process.env.REPORT_TO_EMAIL ||
    process.env.ESCALATION_TO_EMAIL ||
    process.env.SIMULATE_ONLY

  if (!hasAny) {
    console.log("[env-config] No SMTP env vars set — skipping (using DB defaults).")
    return
  }

  const patch: Record<string, unknown> = {}
  if (process.env.SMTP_HOST) patch.smtpHost = process.env.SMTP_HOST.trim()
  if (process.env.SMTP_PORT) {
    const port = parseInt(process.env.SMTP_PORT, 10)
    if (!Number.isNaN(port)) patch.smtpPort = port
  }
  if (process.env.SMTP_USER) patch.smtpUser = process.env.SMTP_USER.trim()
  if (process.env.SMTP_PASS) patch.smtpPass = process.env.SMTP_PASS.trim()
  if (process.env.FROM_EMAIL) patch.fromEmail = process.env.FROM_EMAIL.trim()
  if (process.env.FROM_NAME) patch.fromName = process.env.FROM_NAME.trim()
  if (process.env.REPORT_TO_EMAIL) patch.reportToEmail = process.env.REPORT_TO_EMAIL.trim()
  if (process.env.ESCALATION_TO_EMAIL) {
    patch.escalationToEmail = process.env.ESCALATION_TO_EMAIL.trim()
  }
  const enableReport = boolEnv("ENABLE_REPORT_EMAIL")
  if (enableReport !== undefined) patch.enableReportEmail = enableReport
  const enableEsc = boolEnv("ENABLE_ESCALATION")
  if (enableEsc !== undefined) patch.enableEscalation = enableEsc
  const simulate = boolEnv("SIMULATE_ONLY")
  if (simulate !== undefined) patch.simulateOnly = simulate

  const row = await p.emailSetting.upsert({
    where: { key: "global" },
    update: patch,
    create: { key: "global", ...patch },
  })

  console.log("[env-config] Email settings applied from env vars:")
  console.log(
    JSON.stringify(
      {
        smtpHost: row.smtpHost,
        smtpPort: row.smtpPort,
        smtpUser: row.smtpUser,
        smtpPass: row.smtpPass ? "*** (set)" : "",
        fromEmail: row.fromEmail,
        fromName: row.fromName,
        reportToEmail: row.reportToEmail,
        escalationToEmail: row.escalationToEmail,
        enableReportEmail: row.enableReportEmail,
        enableEscalation: row.enableEscalation,
        simulateOnly: row.simulateOnly,
      },
      null,
      2
    )
  )
}

main()
  .catch((e) => {
    console.error("[env-config] Failed to apply email settings:", e)
    process.exit(0) // non-fatal — do not block server start
  })
  .finally(() => p.$disconnect())

