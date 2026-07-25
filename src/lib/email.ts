import nodemailer from "nodemailer"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
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

/* ---------------- PDF checklist report (attached to emails) ---------------- */
// Uses pdf-lib (pure JS, no external font files) so it works reliably in
// bundled/serverless environments where pdfkit's font-data lookup breaks.

// A4 dimensions in points
const PDF_W = 595.28
const PDF_H = 841.89
const MARGIN = 50
const CONTENT_W = PDF_W - MARGIN * 2

function hexToRgb(hex: string): ReturnType<typeof rgb> {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return rgb(r, g, b)
}

// Wrap text to a max width using the given font/size; returns array of lines.
function wrapText(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, maxWidth: number): string[] {
  const words = String(text || "").split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const test = line ? line + " " + word : word
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test
    } else {
      if (line) lines.push(line)
      // If a single word is too long, hard-break it
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = ""
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) <= maxWidth) {
            chunk += ch
          } else {
            if (chunk) lines.push(chunk)
            chunk = ch
          }
        }
        line = chunk
      } else {
        line = word
      }
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : [""]
}

async function buildInspectionPdf(d: InspectionEmailData, isEscalation = false): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const accentHex = isEscalation ? "#dc2626" : "#0d9488"
  const accent = hexToRgb(accentHex)
  const ink = hexToRgb("#0f172a")
  const muted = hexToRgb("#64748b")
  const faint = hexToRgb("#94a3b8")
  const slateBg = hexToRgb("#f1f5f9")
  const rowBg = hexToRgb("#f8fafc")
  const borderClr = hexToRgb("#e2e8f0")

  const page = doc.addPage([PDF_W, PDF_H])
  // yFromTop helper: pdf-lib y origin is bottom-left
  const yt = (yFromTop: number) => PDF_H - yFromTop

  // ---- Header bar ----
  page.drawRectangle({ x: 0, y: PDF_H - 70, width: PDF_W, height: 70, color: accent })
  page.drawText("SQLMS", { x: MARGIN, y: yt(44), size: 18, font: bold, color: rgb(1, 1, 1) })
  page.drawText(isEscalation ? "Escalation Report" : "Inspection Report", {
    x: MARGIN,
    y: yt(56),
    size: 10,
    font,
    color: rgb(0.9, 0.9, 0.9),
  })

  let y = 95

  // ---- Title ----
  page.drawText(isEscalation ? "Escalation Required" : "Inspection Report", {
    x: MARGIN,
    y: yt(y),
    size: 16,
    font: bold,
    color: ink,
  })
  y += 22
  const subtitle = isEscalation
    ? "An inspection reported issues that require attention."
    : "A new inspection has been completed and logged."
  page.drawText(subtitle, { x: MARGIN, y: yt(y), size: 9, font, color: muted })
  y += 20

  // ---- Info rows ----
  const infoRows: [string, string][] = [
    ["Location", `${d.locationName}  ·  ${d.machineName}`],
    ["Category", `${d.categoryName}${d.departmentName ? "  ·  " + d.departmentName : ""}`],
    ["Completed By", `${d.userName}${d.employeeCode ? " (" + d.employeeCode + ")" : ""}`],
    ["Date / Time", `${d.date}  ·  ${d.time} IST`],
    ["Score", `${d.score.toFixed(1)}%   (${d.passed} passed / ${d.failed} failed / ${d.na} N/A)`],
  ]
  for (const [label, value] of infoRows) {
    page.drawText(label, { x: MARGIN, y: yt(y), size: 8, font, color: faint })
    // wrap value if too long
    const valLines = wrapText(value, font, 10, CONTENT_W - 115)
    valLines.forEach((ln, i) => {
      page.drawText(ln, { x: MARGIN + 115, y: yt(y + i * 13), size: 10, font: bold, color: ink })
    })
    y += Math.max(16, valLines.length * 13 + 3)
  }
  y += 8

  // ---- Summary cards ----
  const cardW = (CONTENT_W - 24) / 4
  const cards: { label: string; value: string; bg: string; fg: string }[] = [
    { label: "Passed", value: String(d.passed), bg: "#dcfce7", fg: "#166534" },
    { label: "Failed", value: String(d.failed), bg: "#fee2e2", fg: "#991b1b" },
    { label: "N/A", value: String(d.na), bg: "#f1f5f9", fg: "#475569" },
    { label: "Score", value: `${d.score.toFixed(1)}%`, bg: accentHex, fg: "#ffffff" },
  ]
  cards.forEach((c, i) => {
    const x = MARGIN + i * (cardW + 8)
    page.drawRectangle({ x, y: yt(y) - 42, width: cardW, height: 42, color: hexToRgb(c.bg) })
    // centered value
    const vw = bold.widthOfTextAtSize(c.value, 15)
    page.drawText(c.value, {
      x: x + (cardW - vw) / 2,
      y: yt(y + 10),
      size: 15,
      font: bold,
      color: hexToRgb(c.fg),
    })
    const lw = font.widthOfTextAtSize(c.label, 8)
    page.drawText(c.label, {
      x: x + (cardW - lw) / 2,
      y: yt(y + 32),
      size: 8,
      font,
      color: hexToRgb(c.fg),
    })
  })
  y += 54

  // ---- Checklist table ----
  // (re-fetch page reference for pagination)
  let curPage = page

  function ensureSpace(needed: number) {
    if (y + needed > PDF_H - 80) {
      curPage = doc.addPage([PDF_W, PDF_H])
      y = MARGIN
    }
  }

  curPage.drawText("Checklist Responses", { x: MARGIN, y: yt(y), size: 11, font: bold, color: hexToRgb("#334155") })
  y += 16
  // table header row
  curPage.drawRectangle({ x: MARGIN, y: yt(y) - 18, width: CONTENT_W, height: 18, color: slateBg })
  curPage.drawText("ITEM", { x: MARGIN + 6, y: yt(y + 5), size: 8, font: bold, color: muted })
  curPage.drawText("STATUS", { x: MARGIN + 230, y: yt(y + 5), size: 8, font: bold, color: muted })
  curPage.drawText("REASON / REMARKS", { x: MARGIN + 310, y: yt(y + 5), size: 8, font: bold, color: muted })
  y += 18

  const responses = isEscalation
    ? d.responses.filter((r) => r.status === "NOT_OK")
    : d.responses

  const statusMeta = {
    OK: { label: "OK", bg: "#dcfce7", fg: "#166534" },
    NOT_OK: { label: "NOT OK", bg: "#fee2e2", fg: "#991b1b" },
    NA: { label: "N/A", bg: "#f1f5f9", fg: "#475569" },
  } as const

  responses.forEach((r, idx) => {
    ensureSpace(26)
    const rowH = 24
    if (idx % 2 === 0) {
      curPage.drawRectangle({ x: MARGIN, y: yt(y) - rowH, width: CONTENT_W, height: rowH, color: rowBg })
    }
    // item
    const itemLines = wrapText(r.item, font, 9, 215)
    itemLines.forEach((ln, i) => {
      curPage.drawText(ln, { x: MARGIN + 6, y: yt(y + 7 + i * 11), size: 9, font, color: ink })
    })
    // status pill
    const meta = statusMeta[r.status]
    const pillW = 52
    const pillX = MARGIN + 230
    curPage.drawRectangle({ x: pillX, y: yt(y + 6) - 14, width: pillW, height: 14, color: hexToRgb(meta.bg) })
    const sw = bold.widthOfTextAtSize(meta.label, 8)
    curPage.drawText(meta.label, {
      x: pillX + (pillW - sw) / 2,
      y: yt(y + 9),
      size: 8,
      font: bold,
      color: hexToRgb(meta.fg),
    })
    // reason
    const reasonLines = wrapText(r.reason || "—", font, 8, CONTENT_W - 320)
    reasonLines.forEach((ln, i) => {
      curPage.drawText(ln, { x: MARGIN + 310, y: yt(y + 7 + i * 10), size: 8, font, color: hexToRgb("#475569") })
    })
    y += Math.max(rowH, Math.max(itemLines.length, reasonLines.length) * 11 + 8)
  })
  y += 12

  // ---- Remarks ----
  if (d.remarks) {
    ensureSpace(50)
    curPage.drawText("REMARKS", { x: MARGIN, y: yt(y), size: 8, font: bold, color: faint })
    y += 12
    const remarkLines = wrapText(d.remarks, font, 9, CONTENT_W - 12)
    const boxH = Math.max(32, remarkLines.length * 12 + 8)
    curPage.drawRectangle({ x: MARGIN, y: yt(y) - boxH, width: CONTENT_W, height: boxH, color: rowBg })
    curPage.drawRectangle({ x: MARGIN, y: yt(y) - boxH, width: CONTENT_W, height: boxH, borderColor: borderClr, borderWidth: 0.5 })
    remarkLines.forEach((ln, i) => {
      curPage.drawText(ln, { x: MARGIN + 6, y: yt(y + 8 + i * 12), size: 9, font, color: hexToRgb("#334155") })
    })
    y += boxH + 8
  }

  // ---- Footer (on every page) ----
  const footerText = `Generated by SQLMS · Smart QR Logbook Management System · ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
  doc.getPages().forEach((p) => {
    const fw = font.widthOfTextAtSize(footerText, 7)
    p.drawText(footerText, {
      x: (PDF_W - fw) / 2,
      y: 30,
      size: 7,
      font,
      color: faint,
    })
  })

  const bytes = await doc.save()
  return Buffer.from(bytes)
}

/* ---------------- Sending ---------------- */
interface EmailAttachment {
  filename: string
  content: Buffer
  contentType: string
}

async function sendOne(
  config: EmailConfig,
  to: string,
  subject: string,
  html: string,
  type: "REPORT" | "ESCALATION",
  inspectionId: string | null,
  attachments: EmailAttachment[] = []
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
      attachments,
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
      timeZone: "Asia/Kolkata",
    }),
    time: inspection.inspectionDate.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }),
    passed: inspection.passedCount,
    failed: inspection.failedCount,
    na: inspection.naCount,
    score: inspection.score,
    remarks: inspection.remarks,
    responses: parseResponses(inspection.responses),
  }

  const tasks: Promise<void>[] = []

  // Generate the PDF checklist report once (used as attachment for both emails).
  // The report PDF contains the full checklist; the escalation PDF lists only failed items.
  let reportPdf: Buffer | null = null
  let escalationPdf: Buffer | null = null
  try {
    reportPdf = await buildInspectionPdf(data, false)
    console.log(`[email] Report PDF generated for ${data.machineName}: ${reportPdf.length} bytes`)
  } catch (err) {
    console.error("[email] Report PDF generation failed:", err instanceof Error ? err.message : err)
    reportPdf = null
  }
  if (inspection.failedCount > 0) {
    try {
      escalationPdf = await buildInspectionPdf(data, true)
      console.log(`[email] Escalation PDF generated for ${data.machineName}: ${escalationPdf.length} bytes`)
    } catch (err) {
      console.error("[email] Escalation PDF generation failed:", err instanceof Error ? err.message : err)
      escalationPdf = null
    }
  }

  // 1. Completion report email (+ PDF attachment of the checklist sheet)
  if (config.enableReportEmail && config.reportToEmail) {
    const { subject, html } = buildReportEmail(data)
    const attachments: EmailAttachment[] = []
    if (reportPdf) {
      attachments.push({
        filename: `Inspection-${data.machineName}-${data.date.replace(/\s+/g, "-")}.pdf`,
        content: reportPdf,
        contentType: "application/pdf",
      })
    }
    tasks.push(
      sendOne(config, config.reportToEmail, subject, html, "REPORT", inspection.id, attachments)
    )
  }

  // 2. Escalation email (only if there are NOT OK items) (+ PDF attachment)
  if (config.enableEscalation && config.escalationToEmail && inspection.failedCount > 0) {
    const { subject, html } = buildEscalationEmail(data)
    const attachments: EmailAttachment[] = []
    const pdfBuf = escalationPdf || reportPdf
    if (pdfBuf) {
      attachments.push({
        filename: `Escalation-${data.machineName}-${data.date.replace(/\s+/g, "-")}.pdf`,
        content: pdfBuf,
        contentType: "application/pdf",
      })
    }
    tasks.push(
      sendOne(
        config,
        config.escalationToEmail,
        subject,
        html,
        "ESCALATION",
        inspection.id,
        attachments
      )
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
