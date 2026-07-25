import nodemailer from "nodemailer"
import { db } from "@/lib/db"
import { parseResponses } from "@/lib/constants"

/* ---------------- Settings ---------------- */
export interface EmailConfig {
  reportToEmail: string
  escalationToEmail: string
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  fromEmail: string
  fromName: string
  enableReportEmail: boolean
  enableEscalation: boolean
  simulateOnly: boolean
}

const DEFAULT_CONFIG: EmailConfig = {
  reportToEmail: "",
  escalationToEmail: "",
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPass: "",
  fromEmail: "",
  fromName: "SQLMS Logbook",
  enableReportEmail: true,
  enableEscalation: true,
  simulateOnly: true,
}

export async function getEmailConfig(): Promise<EmailConfig> {
  let row = await db.emailSetting.findUnique({ where: { key: "global" } })
  if (!row) {
    row = await db.emailSetting.create({ data: { key: "global" } })
  }
  return {
    reportToEmail: row.reportToEmail,
    escalationToEmail: row.escalationToEmail,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpUser: row.smtpUser,
    smtpPass: row.smtpPass,
    fromEmail: row.fromEmail,
    fromName: row.fromName,
    enableReportEmail: row.enableReportEmail,
    enableEscalation: row.enableEscalation,
    simulateOnly: row.simulateOnly,
  }
}

export async function updateEmailConfig(patch: Partial<EmailConfig>): Promise<EmailConfig> {
  const row = await db.emailSetting.upsert({
    where: { key: "global" },
    update: { ...patch },
    create: { key: "global", ...patch },
  })
  return {
    reportToEmail: row.reportToEmail,
    escalationToEmail: row.escalationToEmail,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpUser: row.smtpUser,
    smtpPass: row.smtpPass,
    fromEmail: row.fromEmail,
    fromName: row.fromName,
    enableReportEmail: row.enableReportEmail,
    enableEscalation: row.enableEscalation,
    simulateOnly: row.simulateOnly,
  }
}

/* ---------------- HTML email builder ---------------- */
interface InspectionEmailData {
  inspectionId: string
  locationName: string
  machineName: string
  categoryName: string
  departmentName: string | null
  userName: string
  employeeCode: string | null
  date: string
  time: string
  passed: number
  failed: number
  na: number
  score: number
  remarks: string | null
  responses: {
    item: string
    status: "OK" | "NOT_OK" | "NA"
    reason?: string
  }[]
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function statusBadge(status: "OK" | "NOT_OK" | "NA"): string {
  const map = {
    OK: { bg: "#dcfce7", color: "#166534", label: "OK" },
    NOT_OK: { bg: "#fee2e2", color: "#991b1b", label: "NOT OK" },
    NA: { bg: "#f1f5f9", color: "#475569", label: "N/A" },
  }[status]
  return `<span style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:11px;font-weight:700;background:${map.bg};color:${map.color};">${map.label}</span>`
}

function emailShell(title: string, accent: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.08);">
        <tr><td style="background:${accent};padding:22px 28px;">
          <table width="100%"><tr>
            <td style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:.3px;">SQLMS · ${escapeHtml(title)}</td>
            <td align="right" style="font-size:11px;color:rgba(255,255,255,.85);">Smart QR Logbook</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:28px;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
          This is an automated message from the Smart QR Logbook Management System. Do not reply.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function buildReportEmail(d: InspectionEmailData): { subject: string; html: string } {
  const subject = `${d.categoryName} Inspection Completed — ${d.machineName}`
  const rows = d.responses
    .map(
      (r) => `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">${escapeHtml(r.item)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">${statusBadge(r.status)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;">${r.reason ? escapeHtml(r.reason) : "—"}</td>
      </tr>`
    )
    .join("")
  const body = `
    <h2 style="margin:0 0 4px;font-size:22px;">Inspection Report</h2>
    <p style="margin:0 0 18px;color:#64748b;font-size:13px;">A new inspection has been completed and logged.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="padding:8px 0;width:140px;font-size:12px;color:#94a3b8;">Location</td>
        <td style="padding:8px 0;font-size:13px;font-weight:600;">${escapeHtml(d.locationName)} · ${escapeHtml(d.machineName)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:12px;color:#94a3b8;">Category</td>
        <td style="padding:8px 0;font-size:13px;">${escapeHtml(d.categoryName)}${d.departmentName ? " · " + escapeHtml(d.departmentName) : ""}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:12px;color:#94a3b8;">Completed By</td>
        <td style="padding:8px 0;font-size:13px;">${escapeHtml(d.userName)}${d.employeeCode ? " (" + escapeHtml(d.employeeCode) + ")" : ""}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:12px;color:#94a3b8;">Date / Time</td>
        <td style="padding:8px 0;font-size:13px;">${escapeHtml(d.date)} · ${escapeHtml(d.time)}</td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="background:#dcfce7;color:#166534;border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:800;">${d.passed}</div><div style="font-size:11px;">Passed</div>
        </td>
        <td style="width:8px;"></td>
        <td style="background:#fee2e2;color:#991b1b;border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:800;">${d.failed}</div><div style="font-size:11px;">Failed</div>
        </td>
        <td style="width:8px;"></td>
        <td style="background:#f1f5f9;color:#475569;border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:800;">${d.na}</div><div style="font-size:11px;">N/A</div>
        </td>
        <td style="width:8px;"></td>
        <td style="background:#0d9488;color:#ffffff;border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:800;">${d.score.toFixed(1)}%</div><div style="font-size:11px;">Score</div>
        </td>
      </tr>
    </table>
    <h3 style="margin:0 0 8px;font-size:14px;color:#334155;">Checklist Responses</h3>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:18px;">
      <thead><tr style="background:#f8fafc;">
        <th align="left" style="padding:10px 12px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Item</th>
        <th align="left" style="padding:10px 12px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Status</th>
        <th align="left" style="padding:10px 12px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Reason</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${d.remarks ? `<p style="margin:0 0 6px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">Remarks</p><p style="margin:0;font-size:13px;background:#f8fafc;padding:12px;border-radius:8px;border-left:3px solid #0d9488;">${escapeHtml(d.remarks)}</p>` : ""}
  `
  return { subject, html: emailShell("Inspection Report", "#0d9488", body) }
}

function buildEscalationEmail(d: InspectionEmailData): { subject: string; html: string } {
  const failedItems = d.responses.filter((r) => r.status === "NOT_OK")
  const subject = `⚠ Escalation: ${failedItems.length} Issue(s) — ${d.machineName}`
  const items = failedItems
    .map(
      (r, i) => `<tr>
        <td style="padding:12px;border:1px solid #fecaca;background:#fef2f2;border-radius:8px;margin-bottom:8px;display:block;">
          <div style="font-weight:700;color:#991b1b;font-size:13px;">${i + 1}. ${escapeHtml(r.item)}</div>
          <div style="font-size:12px;color:#7f1d1d;margin-top:4px;">${r.reason ? escapeHtml(r.reason) : "No reason provided"}</div>
        </td>
      </tr>`
    )
    .join("")
  const body = `
    <h2 style="margin:0 0 4px;font-size:22px;color:#dc2626;">⚠ Escalation Required</h2>
    <p style="margin:0 0 18px;color:#64748b;font-size:13px;">An inspection completed at <strong>${escapeHtml(d.locationName)} · ${escapeHtml(d.machineName)}</strong> reported <strong>${failedItems.length} issue(s)</strong> that need attention.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
      <tr>
        <td style="padding:6px 0;width:120px;font-size:12px;color:#94a3b8;">Completed By</td>
        <td style="padding:6px 0;font-size:13px;font-weight:600;">${escapeHtml(d.userName)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:12px;color:#94a3b8;">Date / Time</td>
        <td style="padding:6px 0;font-size:13px;">${escapeHtml(d.date)} · ${escapeHtml(d.time)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:12px;color:#94a3b8;">Score</td>
        <td style="padding:6px 0;font-size:13px;font-weight:600;color:${d.score >= 80 ? "#166534" : "#dc2626"};">${d.score.toFixed(1)}% (${d.passed} passed / ${d.failed} failed)</td>
      </tr>
    </table>
    <h3 style="margin:0 0 8px;font-size:14px;color:#991b1b;">Failed Items</h3>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">${items}</table>
    ${d.remarks ? `<p style="margin:0 0 6px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">Inspector Remarks</p><p style="margin:0;font-size:13px;background:#f8fafc;padding:12px;border-radius:8px;">${escapeHtml(d.remarks)}</p>` : ""}
    <p style="margin:18px 0 0;font-size:12px;color:#64748b;">Please review and initiate corrective action at the earliest.</p>
  `
  return { subject, html: emailShell("Escalation Alert", "#dc2626", body) }
}

/* ---------------- Sending ---------------- */
async function sendOne(
  config: EmailConfig,
  to: string,
  subject: string,
  html: string,
  type: "REPORT" | "ESCALATION",
  inspectionId: string | null
): Promise<void> {
  // SIMULATED mode: log without sending (useful when SMTP isn't configured)
  if (config.simulateOnly || !config.smtpHost || !config.fromEmail) {
    await db.emailLog.create({
      data: {
        to,
        subject,
        bodyHtml: html,
        status: "SIMULATED",
        type,
        inspectionId,
        error: config.simulateOnly
          ? null
          : "SMTP not configured (missing host or from email)",
      },
    })
    return
  }

  // Real SMTP send
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth:
        config.smtpUser && config.smtpPass
          ? { user: config.smtpUser, pass: config.smtpPass }
          : undefined,
    })
    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject,
      html,
    })
    await db.emailLog.create({
      data: {
        to,
        subject,
        bodyHtml: html,
        status: "SENT",
        type,
        inspectionId,
        error: null,
      },
    })
    void info
  } catch (err) {
    await db.emailLog.create({
      data: {
        to,
        subject,
        bodyHtml: html,
        status: "FAILED",
        type,
        inspectionId,
        error: err instanceof Error ? err.message : String(err),
      },
    })
  }
}

/* ---------------- Orchestration: called after an inspection is submitted ---------------- */
export async function sendInspectionEmails(inspectionId: string): Promise<void> {
  const config = await getEmailConfig()

  const inspection = await db.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      location: { include: { category: true, department: true } },
      user: true,
    },
  })
  if (!inspection) return

  const data: InspectionEmailData = {
    inspectionId: inspection.id,
    locationName: inspection.location.name,
    machineName: inspection.location.machineName,
    categoryName: inspection.location.category.name,
    departmentName: inspection.location.department?.name ?? null,
    userName: inspection.user.name,
    employeeCode: inspection.user.employeeCode,
    date: inspection.inspectionDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    time: inspection.inspectionDate.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    passed: inspection.passedCount,
    failed: inspection.failedCount,
    na: inspection.naCount,
    score: inspection.score,
    remarks: inspection.remarks,
    responses: parseResponses(inspection.responses),
  }

  const tasks: Promise<void>[] = []

  // 1. Completion report email
  if (config.enableReportEmail && config.reportToEmail) {
    const { subject, html } = buildReportEmail(data)
    tasks.push(sendOne(config, config.reportToEmail, subject, html, "REPORT", inspection.id))
  }

  // 2. Escalation email (only if there are NOT OK items)
  if (config.enableEscalation && config.escalationToEmail && inspection.failedCount > 0) {
    const { subject, html } = buildEscalationEmail(data)
    tasks.push(
      sendOne(config, config.escalationToEmail, subject, html, "ESCALATION", inspection.id)
    )
  }

  await Promise.allSettled(tasks)
}

/* ---------------- Test email (from settings page) ---------------- */
export async function sendTestEmail(to: string): Promise<{ status: string; error?: string }> {
  const config = await getEmailConfig()
  const html = emailShell(
    "Test Email",
    "#0d9488",
    `<h2 style="margin:0 0 8px;font-size:20px;">✓ Email configuration works</h2>
     <p style="margin:0;font-size:13px;color:#475569;">This is a test email from the SQLMS Logbook. If you received this, your SMTP settings are correct.</p>
     <p style="margin:14px 0 0;font-size:12px;color:#94a3b8;">Sent to: ${escapeHtml(to)} · Mode: ${config.simulateOnly ? "Simulated" : "Live SMTP"}</p>`
  )
  const subject = "SQLMS — Test Email"
  if (config.simulateOnly || !config.smtpHost || !config.fromEmail) {
    await db.emailLog.create({
      data: {
        to,
        subject,
        bodyHtml: html,
        status: "SIMULATED",
        type: "REPORT",
        inspectionId: null,
        error: config.simulateOnly ? null : "SMTP not configured",
      },
    })
    return { status: "SIMULATED" }
  }
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth:
        config.smtpUser && config.smtpPass
          ? { user: config.smtpUser, pass: config.smtpPass }
          : undefined,
    })
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject,
      html,
    })
    await db.emailLog.create({
      data: { to, subject, bodyHtml: html, status: "SENT", type: "REPORT", inspectionId: null },
    })
    return { status: "SENT" }
  } catch (err) {
    await db.emailLog.create({
      data: {
        to,
        subject,
        bodyHtml: html,
        status: "FAILED",
        type: "REPORT",
        inspectionId: null,
        error: err instanceof Error ? err.message : String(err),
      },
    })
    return { status: "FAILED", error: err instanceof Error ? err.message : String(err) }
  }
}
