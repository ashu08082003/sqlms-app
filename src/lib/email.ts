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
export interface InspectionEmailData {
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
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  )
}

/**
 * Sanitize text for pdf-lib's StandardFonts (WinAnsi encoding).
 * Replaces common Unicode punctuation/symbols with ASCII equivalents and
 * strips any remaining non-encodable characters so drawText never throws.
 */
function sanitizeText(input: string): string {
  if (!input) return ""
  const replacements: Record<string, string> = {
    "\u2014": "-", // em dash
    "\u2013": "-", // en dash
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u2022": "*",
    "\u00b7": "*",
    "\u2026": "...",
    "\u20b9": "Rs.",
    "\u2192": "->",
    "\u2190": "<-",
    "\u2713": "OK",
    "\u2717": "X",
    "\u26a0": "!",
    "\u00d7": "x",
    "\u00f7": "/",
    "\u00b0": " deg",
    "\u00b1": "+/-",
    "\u2265": ">=",
    "\u2264": "<=",
    "\u2122": "(TM)",
    "\u00a9": "(c)",
    "\u00ae": "(R)",
  }
  let out = ""
  for (const ch of input) {
    const code = ch.codePointAt(0)!
    if (code < 128) {
      out += ch
    } else if (replacements[ch]) {
      out += replacements[ch]
    } else if (code >= 0xa0 && code <= 0xff) {
      // Latin-1 supplement (encodable in WinAnsi)
      out += ch
    } else {
      // Any other non-encodable character -> space (keeps layout clean)
      out += " "
    }
  }
  return out
}

// Wrap text to a max width using the given font/size; returns array of lines.
function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number
): string[] {
  const words = String(text || "").split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const test = line ? line + " " + word : word
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test
    } else {
      if (line) lines.push(line)
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

// Safe drawText wrapper — sanitizes text and never throws.
// pdf-lib API: page.drawText(text: string, options: { x, y, size, font, color })
function drawTextSafe(
  page: { drawText: (text: string, options: { x: number; y: number; size: number; font: unknown; color: unknown }) => void },
  text: string,
  opts: { x: number; y: number; size: number; font: unknown; color: unknown }
) {
  try {
    page.drawText(sanitizeText(text), opts)
  } catch {
    /* skip unrenderable text */
  }
}

async function buildInspectionPdf(
  d: InspectionEmailData,
  isEscalation = false
): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const accentHex = isEscalation ? "#dc2626" : "#0d9488"
  const accent = hexToRgb(accentHex)
  const ink = hexToRgb("#0f172a")
  const muted = hexToRgb("#475569")
  const faint = hexToRgb("#94a3b8")
  const slateBg = hexToRgb("#f1f5f9")
  const rowBg = hexToRgb("#f8fafc")
  const borderClr = hexToRgb("#e2e8f0")
  const white = rgb(1, 1, 1)

  let page = doc.addPage([PDF_W, PDF_H])
  const yt = (yFromTop: number) => PDF_H - yFromTop

  function ensureSpace(needed: number) {
    if (y + needed > PDF_H - 60) {
      page = doc.addPage([PDF_W, PDF_H])
      y = MARGIN
    }
  }

  let y = 0

  // ============ HEADER BAR ============
  page.drawRectangle({ x: 0, y: PDF_H - 64, width: PDF_W, height: 64, color: accent })
  drawTextSafe(page, "SQLMS", { x: MARGIN, y: yt(42), size: 18, font: bold, color: white })
  drawTextSafe(
    page,
    isEscalation ? "Escalation Report" : "Inspection Report",
    { x: MARGIN, y: yt(54), size: 10, font, color: rgb(0.9, 0.9, 0.9) }
  )
  drawTextSafe(page, "Smart QR Logbook Management System", {
    x: PDF_W - MARGIN - 180,
    y: yt(38),
    size: 8,
    font,
    color: rgb(0.85, 0.85, 0.85),
  })

  y = 88

  // ============ TITLE ============
  drawTextSafe(
    page,
    isEscalation ? "ESCALATION REQUIRED" : "INSPECTION REPORT",
    { x: MARGIN, y: yt(y), size: 15, font: bold, color: accent }
  )
  y += 20
  drawTextSafe(
    page,
    isEscalation
      ? "An inspection reported issue(s) that require attention."
      : "A new inspection has been completed and logged.",
    { x: MARGIN, y: yt(y), size: 9, font, color: muted }
  )
  y += 18

  // ============ INFO TABLE (boxed) ============
  const infoBoxY = y
  const infoRows: [string, string][] = [
    ["Location", `${d.locationName}  /  ${d.machineName}`],
    ["Category", `${d.categoryName}${d.departmentName ? "  /  " + d.departmentName : ""}`],
    ["Completed By", `${d.userName}${d.employeeCode ? "  (" + d.employeeCode + ")" : ""}`],
    ["Date & Time", `${d.date}  ${d.time} IST`],
  ]
  const rowH = 18
  const infoBoxH = infoRows.length * rowH + 8
  page.drawRectangle({
    x: MARGIN,
    y: yt(infoBoxY) - infoBoxH,
    width: CONTENT_W,
    height: infoBoxH,
    color: rowBg,
    borderColor: borderClr,
    borderWidth: 0.5,
  })
  infoRows.forEach(([label, value], i) => {
    const ry = infoBoxY + 4 + i * rowH
    drawTextSafe(page, label.toUpperCase(), {
      x: MARGIN + 8,
      y: yt(ry + 4),
      size: 7,
      font: bold,
      color: faint,
    })
    const valLines = wrapText(sanitizeText(value), font, 9, CONTENT_W - 130)
    valLines.forEach((ln, j) => {
      drawTextSafe(page, ln, {
        x: MARGIN + 120,
        y: yt(ry + 4 + j * 11),
        size: 9,
        font: bold,
        color: ink,
      })
    })
  })
  y = infoBoxY + infoBoxH + 14

  // ============ SUMMARY CARDS ============
  const cardW = (CONTENT_W - 18) / 4
  const cards: { label: string; value: string; bg: string; fg: string }[] = [
    { label: "PASSED", value: String(d.passed), bg: "#dcfce7", fg: "#166534" },
    { label: "FAILED", value: String(d.failed), bg: "#fee2e2", fg: "#991b1b" },
    { label: "N/A", value: String(d.na), bg: "#e2e8f0", fg: "#475569" },
    { label: "SCORE", value: `${d.score.toFixed(1)}%`, bg: accentHex, fg: "#ffffff" },
  ]
  cards.forEach((c, i) => {
    const x = MARGIN + i * (cardW + 6)
    page.drawRectangle({ x, y: yt(y) - 40, width: cardW, height: 40, color: hexToRgb(c.bg) })
    const vw = bold.widthOfTextAtSize(c.value, 16)
    drawTextSafe(page, c.value, {
      x: x + (cardW - vw) / 2,
      y: yt(y + 10),
      size: 16,
      font: bold,
      color: hexToRgb(c.fg),
    })
    const lw = font.widthOfTextAtSize(c.label, 7)
    drawTextSafe(page, c.label, {
      x: x + (cardW - lw) / 2,
      y: yt(y + 30),
      size: 7,
      font,
      color: hexToRgb(c.fg),
    })
  })
  y += 52

  // ============ CHECKLIST TABLE ============
  const responses = isEscalation
    ? d.responses.filter((r) => r.status === "NOT_OK")
    : d.responses

  drawTextSafe(page, "CHECKLIST DETAILS", { x: MARGIN, y: yt(y), size: 11, font: bold, color: ink })
  y += 8
  if (isEscalation) {
    drawTextSafe(page, "(Showing failed items only)", {
      x: PDF_W - MARGIN - 140,
      y: yt(y - 4),
      size: 7,
      font,
      color: faint,
    })
  }
  y += 10

  // Column positions
  const colItem = MARGIN + 6
  const colItemW = 200
  const colStatus = MARGIN + 230
  const statusPillW = 56
  const colReason = MARGIN + 310
  const colReasonW = CONTENT_W - 320

  // Header row
  const hdrH = 18
  page.drawRectangle({ x: MARGIN, y: yt(y) - hdrH, width: CONTENT_W, height: hdrH, color: slateBg })
  drawTextSafe(page, "CHECK ITEM", { x: colItem, y: yt(y + 5), size: 7, font: bold, color: muted })
  drawTextSafe(page, "STATUS", { x: colStatus, y: yt(y + 5), size: 7, font: bold, color: muted })
  drawTextSafe(page, "REASON / REMARKS", { x: colReason, y: yt(y + 5), size: 7, font: bold, color: muted })
  y += hdrH

  const statusMeta = {
    OK: { label: "OK", bg: "#dcfce7", fg: "#166534" },
    NOT_OK: { label: "NOT OK", bg: "#fee2e2", fg: "#991b1b" },
    NA: { label: "N/A", bg: "#e2e8f0", fg: "#475569" },
  } as const

  responses.forEach((r, idx) => {
    const itemLines = wrapText(sanitizeText(r.item), font, 9, colItemW)
    const reasonLines = wrapText(
      sanitizeText(r.reason || "-"),
      font,
      8,
      colReasonW
    )
    const cellH = Math.max(26, itemLines.length * 12 + 8, reasonLines.length * 11 + 8)
    ensureSpace(cellH + 4)

    // Row background (alternating)
    if (idx % 2 === 0) {
      page.drawRectangle({
        x: MARGIN,
        y: yt(y) - cellH,
        width: CONTENT_W,
        height: cellH,
        color: rowBg,
      })
    }
    // Row separator line
    page.drawRectangle({
      x: MARGIN,
      y: yt(y) - cellH,
      width: CONTENT_W,
      height: 0.5,
      color: borderClr,
    })

    // Item text
    itemLines.forEach((ln, i) => {
      drawTextSafe(page, ln, {
        x: colItem,
        y: yt(y + 8 + i * 11),
        size: 9,
        font: bold,
        color: ink,
      })
    })

    // Status pill
    const meta = statusMeta[r.status] || statusMeta.NA
    const pillH = 14
    page.drawRectangle({
      x: colStatus,
      y: yt(y + 7) - pillH,
      width: statusPillW,
      height: pillH,
      color: hexToRgb(meta.bg),
    })
    const sw = bold.widthOfTextAtSize(meta.label, 7)
    drawTextSafe(page, meta.label, {
      x: colStatus + (statusPillW - sw) / 2,
      y: yt(y + 10),
      size: 7,
      font: bold,
      color: hexToRgb(meta.fg),
    })

    // Reason text
    reasonLines.forEach((ln, i) => {
      drawTextSafe(page, ln, {
        x: colReason,
        y: yt(y + 8 + i * 10),
        size: 8,
        font,
        color: muted,
      })
    })

    y += cellH
  })
  y += 14

  // ============ REMARKS ============
  if (d.remarks) {
    ensureSpace(44)
    drawTextSafe(page, "INSPECTOR REMARKS", { x: MARGIN, y: yt(y), size: 8, font: bold, color: faint })
    y += 12
    const remarkLines = wrapText(sanitizeText(d.remarks), font, 9, CONTENT_W - 16)
    const boxH = Math.max(30, remarkLines.length * 12 + 10)
    ensureSpace(boxH + 4)
    page.drawRectangle({
      x: MARGIN,
      y: yt(y) - boxH,
      width: CONTENT_W,
      height: boxH,
      color: rowBg,
      borderColor: borderClr,
      borderWidth: 0.5,
    })
    remarkLines.forEach((ln, i) => {
      drawTextSafe(page, ln, {
        x: MARGIN + 8,
        y: yt(y + 9 + i * 12),
        size: 9,
        font,
        color: ink,
      })
    })
    y += boxH + 6
  }

  // ============ FOOTER (on every page) ============
  const footerText = sanitizeText(
    `Generated by SQLMS - Smart QR Logbook Management System - ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
  )
  doc.getPages().forEach((p) => {
    try {
      const fw = font.widthOfTextAtSize(footerText, 7)
      p.drawText(footerText, {
        x: (PDF_W - fw) / 2,
        y: 28,
        size: 7,
        font,
        color: faint,
      })
    } catch {
      /* ignore */
    }
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
      requireTLS: config.smtpPort !== 465,
      connectionTimeout: 10000,
      socketTimeout: 10000,
      logger: true,
      debug: true,
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
    const errorMessage =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.error("[email] Failed to send SMTP email:", errorMessage, err)
    await db.emailLog.create({
      data: {
        to,
        subject,
        bodyHtml: html,
        status: "FAILED",
        type,
        inspectionId,
        error: errorMessage,
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
      requireTLS: config.smtpPort !== 465,
      connectionTimeout: 10000,
      socketTimeout: 10000,
      logger: true,
      debug: true,
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
    const errorMessage =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.error("[email] Failed to send test email:", errorMessage, err)
    await db.emailLog.create({
      data: {
        to,
        subject,
        bodyHtml: html,
        status: "FAILED",
        type: "REPORT",
        inspectionId: null,
        error: errorMessage,
      },
    })
    return { status: "FAILED", error: errorMessage }
  }
}

/* ---------------- Consolidated Period Report (PDF + email) ---------------- */
export interface ConsolidatedReportData {
  location: {
    qrCode: string
    name: string
    machineName: string
    categoryName: string
    categoryColor: string
    departmentName: string | null
    frequency: string
  }
  checklist: { name: string | null; items: string[] }
  period: { type: string; label: string; start: string; end: string }
  days: { date: string; label: string; weekday: string }[]
  matrix: {
    item: string
    days: { date: string; status: "OK" | "NOT_OK" | "NA" | null; reason: string | null }[]
  }[]
  summary: {
    totalDays: number
    inspectedDays: number
    missedDays: number
    completionRate: number
    totalPassed: number
    totalFailed: number
    totalNa: number
    avgScore: number
    inspectionCount: number
  }
  failures: { date: string; item: string; reason: string; userName: string }[]
}

export async function buildConsolidatedPdf(d: ConsolidatedReportData): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const accent = hexToRgb("#0d9488")
  const ink = hexToRgb("#0f172a")
  const muted = hexToRgb("#475569")
  const faint = hexToRgb("#94a3b8")
  const slateBg = hexToRgb("#f1f5f9")
  const rowBg = hexToRgb("#f8fafc")
  const borderClr = hexToRgb("#e2e8f0")
  const white = rgb(1, 1, 1)
  const okBg = hexToRgb("#dcfce7")
  const failBg = hexToRgb("#fee2e2")
  const naBg = hexToRgb("#e2e8f0")

  let page = doc.addPage([PDF_W, PDF_H])
  const yt = (yFromTop: number) => PDF_H - yFromTop

  let y = 0

  function ensureSpace(needed: number) {
    if (y + needed > PDF_H - 60) {
      page = doc.addPage([PDF_W, PDF_H])
      y = MARGIN
    }
  }

  // ============ HEADER BAR ============
  page.drawRectangle({ x: 0, y: PDF_H - 64, width: PDF_W, height: 64, color: accent })
  drawTextSafe(page, "SQLMS", { x: MARGIN, y: yt(42), size: 18, font: bold, color: white })
  drawTextSafe(
    page,
    "Consolidated " + (d.period.type === "week" ? "Weekly" : "Monthly") + " Report",
    { x: MARGIN, y: yt(54), size: 10, font, color: rgb(0.9, 0.9, 0.9) }
  )

  y = 88
  // ============ TITLE ============
  drawTextSafe(page, "CONSOLIDATED INSPECTION REPORT", { x: MARGIN, y: yt(y), size: 14, font: bold, color: accent })
  y += 18
  drawTextSafe(page, d.period.label, { x: MARGIN, y: yt(y), size: 10, font, color: muted })
  y += 16

  // ============ INFO TABLE ============
  const infoRows: [string, string][] = [
    ["Location", d.location.name + "  /  " + d.location.machineName],
    ["QR Code", d.location.qrCode],
    ["Category", d.location.categoryName + (d.location.departmentName ? "  /  " + d.location.departmentName : "")],
    ["Checklist", d.checklist.name || "-"],
    ["Period", d.period.label],
    ["Frequency", d.location.frequency],
  ]
  const rowH = 16
  const infoBoxH = infoRows.length * rowH + 8
  page.drawRectangle({
    x: MARGIN,
    y: yt(y) - infoBoxH,
    width: CONTENT_W,
    height: infoBoxH,
    color: rowBg,
    borderColor: borderClr,
    borderWidth: 0.5,
  })
  infoRows.forEach(([label, value], i) => {
    const ry = y + 4 + i * rowH
    drawTextSafe(page, label.toUpperCase(), { x: MARGIN + 8, y: yt(ry + 3), size: 7, font: bold, color: faint })
    drawTextSafe(page, value, { x: MARGIN + 110, y: yt(ry + 3), size: 9, font: bold, color: ink })
  })
  y += infoBoxH + 14

  // ============ SUMMARY CARDS ============
  const cardW = (CONTENT_W - 30) / 5
  const cards: { label: string; value: string; bg: string; fg: string }[] = [
    { label: "INSPECTED", value: String(d.summary.inspectedDays) + "/" + d.summary.totalDays, bg: "#dcfce7", fg: "#166534" },
    { label: "COMPLETION", value: d.summary.completionRate + "%", bg: "#0d9488", fg: "#ffffff" },
    { label: "PASSED", value: String(d.summary.totalPassed), bg: "#dcfce7", fg: "#166534" },
    { label: "FAILED", value: String(d.summary.totalFailed), bg: "#fee2e2", fg: "#991b1b" },
    { label: "AVG SCORE", value: d.summary.avgScore + "%", bg: "#e2e8f0", fg: "#475569" },
  ]
  cards.forEach((c, i) => {
    const x = MARGIN + i * (cardW + 6)
    page.drawRectangle({ x, y: yt(y) - 36, width: cardW, height: 36, color: hexToRgb(c.bg) })
    const vw = bold.widthOfTextAtSize(c.value, 12)
    drawTextSafe(page, c.value, { x: x + (cardW - vw) / 2, y: yt(y + 9), size: 12, font: bold, color: hexToRgb(c.fg) })
    const lw = font.widthOfTextAtSize(c.label, 6)
    drawTextSafe(page, c.label, { x: x + (cardW - lw) / 2, y: yt(y + 26), size: 6, font, color: hexToRgb(c.fg) })
  })
  y += 48

  // ============ MATRIX TABLE ============
  drawTextSafe(page, "CHECKLIST STATUS MATRIX", { x: MARGIN, y: yt(y), size: 11, font: bold, color: ink })
  y += 16

  const days = d.days
  const itemColW = 140
  const dayColW = (CONTENT_W - itemColW) / Math.max(days.length, 1)

  // Header row: day labels
  const hdrH = 22
  page.drawRectangle({ x: MARGIN, y: yt(y) - hdrH, width: CONTENT_W, height: hdrH, color: slateBg })
  drawTextSafe(page, "CHECK ITEM", { x: MARGIN + 4, y: yt(y + 7), size: 7, font: bold, color: muted })
  days.forEach((day, i) => {
    const x = MARGIN + itemColW + i * dayColW
    drawTextSafe(page, day.label.split(" ")[0], { x: x + 2, y: yt(y + 4), size: 6, font: bold, color: muted })
    drawTextSafe(page, day.weekday, { x: x + 2, y: yt(y + 13), size: 6, font, color: faint })
  })
  y += hdrH

  // Matrix rows
  const cellH = 18
  d.matrix.forEach((row, idx) => {
    ensureSpace(cellH + 4)
    if (idx % 2 === 0) {
      page.drawRectangle({ x: MARGIN, y: yt(y) - cellH, width: CONTENT_W, height: cellH, color: rowBg })
    }
    page.drawRectangle({ x: MARGIN, y: yt(y) - cellH, width: CONTENT_W, height: 0.5, color: borderClr })

    // Item label (wrapped)
    const itemLines = wrapText(sanitizeText(row.item), font, 7, itemColW - 8)
    itemLines.slice(0, 2).forEach((ln, i) => {
      drawTextSafe(page, ln, { x: MARGIN + 4, y: yt(y + 5 + i * 8), size: 7, font, color: ink })
    })

    // Day cells
    row.days.forEach((dayCell, i) => {
      const x = MARGIN + itemColW + i * dayColW
      const cx = x + dayColW / 2
      if (dayCell.status === "OK") {
        page.drawRectangle({ x: x + 1, y: yt(y + 2), width: dayColW - 2, height: cellH - 4, color: okBg })
        drawTextSafe(page, "OK", { x: cx - 5, y: yt(y + 6), size: 6, font: bold, color: hexToRgb("#166534") })
      } else if (dayCell.status === "NOT_OK") {
        page.drawRectangle({ x: x + 1, y: yt(y + 2), width: dayColW - 2, height: cellH - 4, color: failBg })
        drawTextSafe(page, "X", { x: cx - 3, y: yt(y + 6), size: 7, font: bold, color: hexToRgb("#991b1b") })
      } else if (dayCell.status === "NA") {
        page.drawRectangle({ x: x + 1, y: yt(y + 2), width: dayColW - 2, height: cellH - 4, color: naBg })
        drawTextSafe(page, "-", { x: cx - 2, y: yt(y + 6), size: 7, font, color: hexToRgb("#475569") })
      } else {
        drawTextSafe(page, "-", { x: cx - 2, y: yt(y + 6), size: 7, font, color: faint })
      }
    })
    y += cellH
  })
  y += 12

  // ============ FAILURES LIST ============
  if (d.failures.length > 0) {
    ensureSpace(40)
    drawTextSafe(page, "ALL FAILURES IN PERIOD (" + d.failures.length + ")", { x: MARGIN, y: yt(y), size: 10, font: bold, color: hexToRgb("#991b1b") })
    y += 14
    d.failures.slice(0, 30).forEach((f, i) => {
      ensureSpace(16)
      drawTextSafe(page, f.date + "  " + f.item + "  -  " + f.reason + "  (" + f.userName + ")", {
        x: MARGIN + 4,
        y: yt(y),
        size: 7,
        font,
        color: muted,
      })
      y += 13
    })
    if (d.failures.length > 30) {
      drawTextSafe(page, "... and " + (d.failures.length - 30) + " more", { x: MARGIN + 4, y: yt(y), size: 7, font, color: faint })
      y += 13
    }
    y += 8
  }

  // ============ FOOTER ============
  const footerText = sanitizeText(
    "Generated by SQLMS - Smart QR Logbook Management System - " +
      new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) +
      " IST"
  )
  doc.getPages().forEach((p) => {
    try {
      const fw = font.widthOfTextAtSize(footerText, 7)
      p.drawText(footerText, { x: (PDF_W - fw) / 2, y: 28, size: 7, font, color: faint })
    } catch {
      /* ignore */
    }
  })

  const bytes = await doc.save()
  return Buffer.from(bytes)
}

export async function sendConsolidatedReportEmail(
  to: string,
  data: ConsolidatedReportData
): Promise<{ status: string; error?: string }> {
  const config = await getEmailConfig()
  const pdfBuf = await buildConsolidatedPdf(data)

  const periodWord = data.period.type === "week" ? "Weekly" : "Monthly"
  const subject =
    periodWord + " Consolidated Report - " + data.location.machineName + " - " + data.period.label
  const html = emailShell(
    periodWord + " Consolidated Report",
    "#0d9488",
    `<h2 style="margin:0 0 8px;font-size:20px;">` +
      periodWord +
      ` Report</h2>
     <p style="margin:0 0 14px;font-size:13px;color:#475569;">Consolidated inspection report for <strong>` +
      escapeHtml(data.location.name) +
      ` / ` +
      escapeHtml(data.location.machineName) +
      `</strong> for the period <strong>` +
      escapeHtml(data.period.label) +
      `</strong>.</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#dcfce7;color:#166534;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:20px;font-weight:800;">` +
      data.summary.inspectedDays +
      `/` +
      data.summary.totalDays +
      `</div><div style="font-size:11px;">Days Inspected</div></td>
        <td style="width:8px;"></td>
        <td style="background:#0d9488;color:#fff;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:20px;font-weight:800;">` +
      data.summary.completionRate +
      `%</div><div style="font-size:11px;">Completion</div></td>
        <td style="width:8px;"></td>
        <td style="background:#fee2e2;color:#991b1b;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:20px;font-weight:800;">` +
      data.summary.totalFailed +
      `</div><div style="font-size:11px;">Failed Items</div></td>
        <td style="width:8px;"></td>
        <td style="background:#f1f5f9;color:#475569;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:20px;font-weight:800;">` +
      data.summary.avgScore +
      `%</div><div style="font-size:11px;">Avg Score</div></td>
      </tr>
     </table>
     <p style="margin:18px 0 0;font-size:12px;color:#64748b;">The full checklist status matrix is attached as a PDF.</p>`
  )

  const filename =
    (periodWord + "-Report-" + data.location.machineName + "-" + data.period.label)
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .replace(/-+/g, "-") + ".pdf"

  const attachments: EmailAttachment[] = [
    { filename, content: pdfBuf, contentType: "application/pdf" },
  ]

  // SIMULATED mode
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

  // Live SMTP
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      requireTLS: config.smtpPort !== 465,
      connectionTimeout: 10000,
      socketTimeout: 10000,
      logger: true,
      debug: true,
      auth:
        config.smtpUser && config.smtpPass
          ? { user: config.smtpUser, pass: config.smtpPass }
          : undefined,
    })
    await transporter.sendMail({
      from: '"' + config.fromName + '" <' + config.fromEmail + ">",
      to,
      subject,
      html,
      attachments,
    })
    await db.emailLog.create({
      data: { to, subject, bodyHtml: html, status: "SENT", type: "REPORT", inspectionId: null },
    })
    return { status: "SENT" }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.error("[email] Failed to send consolidated report email:", errorMessage, err)
    await db.emailLog.create({
      data: {
        to,
        subject,
        bodyHtml: html,
        status: "FAILED",
        type: "REPORT",
        inspectionId: null,
        error: errorMessage,
      },
    })
    return { status: "FAILED", error: errorMessage }
  }
}
