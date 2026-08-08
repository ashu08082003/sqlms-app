"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  CalendarRange,
  Loader2,
  Send,
  FileDown,
  Mail,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { apiFetch } from "@/lib/api-client"
import { useAppStore } from "@/store/app-store"
import { EmptyState } from "@/components/empty-state"
import { CategoryBadge } from "@/components/category-badge"
import { cn } from "@/lib/utils"

interface LocationRow {
  id: string
  qrCode: string
  name: string
  machineName: string
  categoryName: string
  categoryColor: string
  categoryIcon: string
  frequency: string
}

interface ConsolidatedData {
  location: {
    qrCode: string
    name: string
    machineName: string
    categoryName: string
    categoryColor: string
    departmentName: string | null
    frequency: string
  }
checklist: { name: string | null; description: string | null; documentNumber: string | null; items: string[] }
  period: { type: string; label: string; start: string; end: string; year: number; month: number; granularity: string }
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
  dueInfo: {
    lastInspectionDate: string | null
    lastInspectionLabel: string | null
    nextDueAt: string | null
    nextDueLabel: string | null
  }
}

function statusCell(status: "OK" | "NOT_OK" | "NA" | null) {
  if (status === "OK")
    return (
      <span
        className="inline-flex h-7 w-full items-center justify-center rounded bg-emerald-500/15 text-[10px] font-bold text-emerald-700 dark:text-emerald-400"
        title="OK"
      >
        OK
      </span>
    )
  if (status === "NOT_OK")
    return (
      <span
        className="inline-flex h-7 w-full items-center justify-center rounded bg-red-500/15 text-[10px] font-bold text-red-700 dark:text-red-400"
        title="Not OK"
      >
        X
      </span>
    )
  if (status === "NA")
    return (
      <span
        className="inline-flex h-7 w-full items-center justify-center rounded bg-zinc-400/15 text-[10px] font-bold text-zinc-600 dark:text-zinc-400"
        title="N/A"
      >
        -
      </span>
    )
  return (
    <span className="inline-flex h-7 w-full items-center justify-center text-[10px] text-muted-foreground/40" title="Not inspected">
      ·
    </span>
  )
}

export function ConsolidatedReportsView() {
  const refreshKey = useAppStore((s) => s.refreshKey)

  const { data: locsData } = useQuery({
    queryKey: ["locations", refreshKey],
    queryFn: () => apiFetch<{ locations: LocationRow[] }>("/api/locations"),
  })
  const locations = locsData?.locations ?? []

  const now = new Date()
  const [locationId, setLocationId] = useState<string>("")
  const [period, setPeriod] = useState<"week" | "month">("month")
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  // Auto-select first location
  if (!locationId && locations.length > 0) setLocationId(locations[0].id)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["consolidated", locationId, period, year, month, refreshKey],
    queryFn: () =>
      apiFetch<ConsolidatedData>(
        `/api/reports/consolidated?locationId=${locationId}&period=${period}&year=${year}&month=${month}`
      ),
    enabled: !!locationId,
  })

  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState("")

  const emailMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ status: string; error?: string }>("/api/reports/email", {
        method: "POST",
        body: JSON.stringify({ locationId, period, year, month, to: emailTo }),
      }),
    onSuccess: (res) => {
      if (res.status === "SENT") toast.success("Consolidated report emailed successfully")
      else if (res.status === "SIMULATED") toast.info("Report simulated (logged but not sent - Simulate mode ON)")
      else toast.error(res.error || "Email failed")
      setEmailOpen(false)
    },
    onError: (e: Error) => toast.error(e.message || "Failed to send email"),
  })

  function shiftPeriod(dir: -1 | 1) {
    if (period === "month") {
      let m = month + dir
      let y = year
      if (m < 1) {
        m = 12
        y--
      } else if (m > 12) {
        m = 1
        y++
      }
      setMonth(m)
      setYear(y)
    } else {
      // shift by 7 days via year+month approximation: use a date and move 7 days
      const d = new Date(year, month - 1, 15)
      d.setDate(d.getDate() + dir * 7)
      setYear(d.getFullYear())
      setMonth(d.getMonth() + 1)
    }
  }

  function exportCsv() {
    if (!data) return
const rows: string[][] = []
    rows.push(["Location", `${data.location.name} / ${data.location.machineName} (${data.location.qrCode})`])
    rows.push(["Category", data.location.categoryName])
    rows.push(["Checklist", data.checklist.name || "-"])
    rows.push(["Document No.", data.checklist.documentNumber || "00"])
    rows.push(["Comment", data.checklist.description || "-"])
    rows.push(["Period", data.period.label])
    rows.push(["Frequency", data.location.frequency])
    rows.push([])
    rows.push(["Check Item", ...data.days.map((d) => d.label)])
    for (const row of data.matrix) {
      rows.push([
        row.item,
        ...row.days.map((d) => (d.status === "OK" ? "OK" : d.status === "NOT_OK" ? "NOT OK" : d.status === "NA" ? "N/A" : "-")),
      ])
    }
    rows.push([])
    rows.push(["Summary"])
    rows.push(["Total Days", String(data.summary.totalDays)])
    rows.push(["Inspected Days", String(data.summary.inspectedDays)])
    rows.push(["Missed Days", String(data.summary.missedDays)])
    rows.push(["Completion Rate", data.summary.completionRate + "%"])
    rows.push(["Total Passed", String(data.summary.totalPassed)])
    rows.push(["Total Failed", String(data.summary.totalFailed)])
    rows.push(["Total N/A", String(data.summary.totalNa)])
    rows.push(["Average Score", data.summary.avgScore + "%"])
    rows.push([])
    rows.push(["Failures in period"])
    rows.push(["Date", "Item", "Reason", "Inspector"])
    for (const f of data.failures) {
      rows.push([f.date, f.item, f.reason, f.userName])
    }
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Consolidated-${data.location.machineName}-${data.period.label.replace(/\s+/g, "-")}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV exported")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Period Reports</h2>
          <p className="text-sm text-muted-foreground">
            Consolidated weekly & monthly reports — all daily inspections merged into one matrix.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} / {l.machineName} ({l.qrCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Period</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as "week" | "month")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v, 10))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(
                    (m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value || String(now.getFullYear()), 10))}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => shiftPeriod(-1)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => shiftPeriod(1)}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setYear(now.getFullYear())
                setMonth(now.getMonth() + 1)
              }}
            >
              Current
            </Button>
          </div>
        </CardContent>
      </Card>

      {!locationId ? (
        <EmptyState
          icon={CalendarRange}
          title="Select a location"
          description="Choose a QR location to view its consolidated period report."
        />
      ) : isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Failed to load report"
          description="There was an error building the consolidated report. Please try again."
        />
) : !data ? null : !Array.isArray(data.matrix) || !Array.isArray(data.days) || !Array.isArray(data.failures) || !data.matrix.length ? (
        <EmptyState
          icon={CalendarRange}
          title="No checklist data"
          description="This location has no checklist assigned and no inspections in the selected period."
        />
      ) : (
        <>
          {/* Location + period header */}
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-4">
                <span
                  className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: data.location.categoryColor }}
                >
                  <CalendarRange className="h-6 w-6" />
                </span>
<div>
                  <p className="text-lg font-bold">
                    {data.location.name} / {data.location.machineName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {data.location.categoryName}
                    {data.location.departmentName ? " · " + data.location.departmentName : ""} · {data.location.qrCode}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Doc No:</span>{" "}
                    {data.checklist.documentNumber || "00"}
                    {data.checklist.description ? (
                      <span className="ml-3">
                        <span className="font-medium text-foreground">Comment:</span>{" "}
                        {data.checklist.description}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{data.period.label}</p>
                <p className="text-xs text-muted-foreground capitalize">{data.period.type} report</p>
              </div>
            </CardContent>
          </Card>

{/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Days Inspected", value: `${data.summary.inspectedDays}/${data.summary.totalDays}`, tone: "bg-emerald-500/10 text-emerald-600" },
              { label: "Completion", value: `${data.summary.completionRate}%`, tone: "bg-primary/10 text-primary" },
              { label: "Total Passed", value: data.summary.totalPassed, tone: "bg-emerald-500/10 text-emerald-600" },
              { label: "Total Failed", value: data.summary.totalFailed, tone: "bg-red-500/10 text-red-600" },
              { label: "Avg Score", value: `${data.summary.avgScore}%`, tone: "bg-zinc-500/10 text-zinc-600" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <div className={cn("mb-1 inline-flex rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", s.tone)}>
                    {s.label}
                  </div>
                  <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Due info: last inspection + next due */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Last Inspection</p>
                  <p className="text-sm font-semibold">
                    {data.dueInfo.lastInspectionLabel || "No inspections yet"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <CalendarRange className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Next Due</p>
                  <p className="text-sm font-semibold">
                    {data.dueInfo.nextDueLabel || "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportCsv} variant="outline">
              <FileDown className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={() => setEmailOpen(true)}>
              <Mail className="mr-2 h-4 w-4" /> Email Report (PDF)
            </Button>
          </div>

          {/* Matrix table */}
          <Card>
            <CardHeader className="pb-3">
<CardTitle className="text-base">Checklist Status Matrix</CardTitle>
<CardDescription>
                Each row is a checklist item; each column is a {data.period.granularity || "period"}. Green = OK, Red = Not OK, Gray = N/A, dot = not inspected.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="sticky left-0 z-10 min-w-[160px] bg-muted/50 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        Check Item
                      </th>
                      {data.days.map((d) => (
                        <th key={d.date} className="px-1 py-2 text-center align-bottom">
                          <div className="text-[10px] font-bold text-muted-foreground">{d.label.split(" ")[0]}</div>
                          <div className="text-[9px] text-muted-foreground/70">{d.weekday}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.matrix.map((row, idx) => (
                      <tr key={row.item} className={cn("border-b", idx % 2 === 0 && "bg-muted/20")}>
                        <td className="sticky left-0 z-10 min-w-[160px] bg-card px-3 py-1.5 text-xs font-medium">
                          {row.item}
                        </td>
                        {row.days.map((dc) => (
                          <td key={dc.date} className="px-1 py-1 text-center">
                            {statusCell(dc.status)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Failures list */}
          {data.failures.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  All Failures in Period ({data.failures.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-80 overflow-y-auto scrollbar-thin">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left text-[11px] font-bold uppercase text-muted-foreground">Date</th>
                        <th className="px-4 py-2 text-left text-[11px] font-bold uppercase text-muted-foreground">Item</th>
                        <th className="px-4 py-2 text-left text-[11px] font-bold uppercase text-muted-foreground">Reason</th>
                        <th className="px-4 py-2 text-left text-[11px] font-bold uppercase text-muted-foreground">Inspector</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.failures.map((f, i) => (
                        <tr key={i} className="border-b">
                          <td className="px-4 py-2 text-xs whitespace-nowrap">{f.date}</td>
                          <td className="px-4 py-2 text-xs font-medium">{f.item}</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{f.reason}</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{f.userName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-5 w-8 items-center justify-center rounded bg-emerald-500/15 text-[9px] font-bold text-emerald-700">OK</span>
              OK / Passed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-5 w-8 items-center justify-center rounded bg-red-500/15 text-[9px] font-bold text-red-700">X</span>
              Not OK / Failed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-5 w-8 items-center justify-center rounded bg-zinc-400/15 text-[9px] font-bold text-zinc-600">-</span>
              N/A
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-5 w-8 items-center justify-center text-muted-foreground/40">·</span>
              Not inspected
            </span>
          </div>
        </>
      )}

      {/* Email dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Email Consolidated Report</DialogTitle>
            <DialogDescription>
              The {data?.period.type === "week" ? "weekly" : "monthly"} report for {data?.location.machineName} will be generated as a PDF and emailed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="email-to">Recipient email</Label>
              <Input
                id="email-to"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="manager@plant.com"
              />
            </div>
            {data && (
              <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                <p><strong>Location:</strong> {data.location.name} / {data.location.machineName}</p>
                <p><strong>Period:</strong> {data.period.label}</p>
                <p><strong>Inspected:</strong> {data.summary.inspectedDays}/{data.summary.totalDays} days ({data.summary.completionRate}%)</p>
                <p><strong>Failures:</strong> {data.summary.totalFailed}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => emailMutation.mutate()}
              disabled={emailMutation.isPending || !emailTo}
            >
              {emailMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
