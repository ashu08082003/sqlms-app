/**
 * Applies SMTP / email configuration into the database automatically.
 * This runs on every container start so that Railway-deployed instances
 * always have working email capability WITHOUT needing to manually set
 * SMTP variables in Railway or re-enter credentials through the admin UI.
 *
 * Default SMTP settings are baked in below (Gmail). Optionally, any of
 * these can be overridden via environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, FROM_NAME
 *   REPORT_TO_EMAIL, ESCALATION_TO_EMAIL
 *   ENABLE_REPORT_EMAIL, ENABLE_ESCALATION, SIMULATE_ONLY
 *
 * If an env var is set, it takes precedence over the baked-in default.
 */
import { PrismaClient } from "@prisma/client"

const p = new PrismaClient()

// ---------------------------------------------------------------------------
// BAKED-IN DEFAULTS (edit these to change email behaviour without Railway vars)
// ---------------------------------------------------------------------------
const DEFAULTS = {
  smtpHost: "smtp.gmail.com",
  smtpPort: 587,
  smtpUser: "mspipl.gate@gmail.com",
  smtpPass: "vnzv xhod iuzb peny",
  fromEmail: "mspipl.gate@gmail.com",
  fromName: "SQLMS Logbook",
  reportToEmail: "it@mspindia.in",
  escalationToEmail: "it@mspindia.in",
  enableReportEmail: true,
  enableEscalation: true,
  simulateOnly: false,
}

function boolEnv(name: string): boolean | undefined {
  const v = process.env[name]
  if (v === undefined || v === "") return undefined
  return v.toLowerCase() === "true" || v === "1"
}

async function main() {
  const patch: Record<string, unknown> = {}

  // Start from baked-in defaults
  patch.smtpHost = DEFAULTS.smtpHost
  patch.smtpPort = DEFAULTS.smtpPort
  patch.smtpUser = DEFAULTS.smtpUser
  patch.smtpPass = DEFAULTS.smtpPass
  patch.fromEmail = DEFAULTS.fromEmail
  patch.fromName = DEFAULTS.fromName
  patch.reportToEmail = DEFAULTS.reportToEmail
  patch.escalationToEmail = DEFAULTS.escalationToEmail
  patch.enableReportEmail = DEFAULTS.enableReportEmail
  patch.enableEscalation = DEFAULTS.enableEscalation
  patch.simulateOnly = DEFAULTS.simulateOnly

  // Optional env-var overrides (take precedence over baked-in defaults)
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

  console.log("[env-config] Email settings applied (baked-in defaults + optional env overrides):")
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
