"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Search,
  Filter,
  Download,
  Printer,
  Eye,
  X,
  ClipboardList,
  Building2,
  User as UserIcon,
  Tag,
  Calendar,
  Hash,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  apiFetch,
  formatDate,
  formatTime,
  formatDateTime,
} from "@/lib/api-client"
import { useAppStore } from "@/store/app-store"
import { STATUS_META } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { ItemStatus } from "@/lib/types"

/* ---------- Local API shape interfaces ---------- */
interface InspectionLocationSummary {
  id: string
  qrCode: string
  name: string
  machineName: string
  categoryName: string
  categoryColor: string
  departmentName: string | null
}
interface InspectionListItem {
  id: string
  inspectionDate: string
  status: string
  passedCount: number
  failedCount: number
  naCount: number
  score: number
  remarks: string | null
  photoUrl: string | null
  location: InspectionLocationSummary
  user: { id: string; name: string; employeeCode: string | null }
  checklist: { id: string; name: string } | null
}
interface InspectionResponseRow {
  item: string
  status: ItemStatus
  reason?: string
  photoUrl?: string
}
interface InspectionDetail extends InspectionListItem {
  responses: InspectionResponseRow[]
}
interface CategoryOption {
  id: string
  name: string
  slug: string
  icon: string
  color: string
  description: string | null
  locationCount: number
  checklistCount: number
}
interface LocationOption {
  id: string
  qrCode: string
  name: string
  machineName: string
  categoryId: string
  categoryName: string
  frequency: string
}
interface Filters {
  search: string
  categoryId: string
  locationId: string
  from: string
  to: string
}

/* ---------- Small helpers ---------- */
function scoreBadgeClass(score: number): string {
  return score >= 95
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30"
    : score >= 80
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30"
      : "bg-red-500/15 text-red-700 dark:text-red-400 ring-1 ring-red-500/30"
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        scoreBadgeClass(score)
      )}
    >
      {score.toFixed(1)}%
    </span>
  )
}

function StatusPill({ status }: { status: ItemStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white",
        meta.bg
      )}
    >
      {meta.label}
    </span>
  )
}

function DetailMeta({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Tag
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5">
      {color ? (
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : (
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-xs font-medium">{value}</p>
      </div>
    </div>
  )
}

function CountCell({
  label,
  value,
  cls,
}: {
  label: string
  value: number
  cls: "emerald" | "red" | "zinc"
}) {
  const colorMap = {
    emerald: "bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
    red: "bg-red-500/5 text-red-700 dark:text-red-400",
    zinc: "bg-zinc-500/5 text-zinc-600 dark:text-zinc-400",
  } as const
  return (
    <div className={cn("rounded-lg border p-3 text-center", colorMap[cls])}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  )
}

function MobileCard({
  insp,
  onView,
}: {
  insp: InspectionListItem
  onView: () => void
}) {
  const d = new Date(insp.inspectionDate)
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <span
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: insp.location.categoryColor }}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {insp.location.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {insp.location.qrCode} · {insp.location.machineName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {formatDateTime(d)} · {insp.user.name}
              </p>
            </div>
          </div>
          <ScoreBadge score={insp.score} />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              {insp.passedCount} OK
            </span>
            {insp.failedCount > 0 && (
              <span className="font-medium text-red-700 dark:text-red-400">
                {insp.failedCount} fail
              </span>
            )}
            <span className="text-zinc-600 dark:text-zinc-400">
              {insp.naCount} N/A
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onView}>
            <Eye className="mr-1 h-4 w-4" /> View
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* ---------- Main view ---------- */
export function InspectionsView() {
  const refreshKey = useAppStore((s) => s.refreshKey)

  const [filters, setFilters] = useState<Filters>({
    search: "",
    categoryId: "all",
    locationId: "all",
    from: "",
    to: "",
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [printMode, setPrintMode] = useState<"list" | "detail" | null>(null)

  /* Build query string */
  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (filters.search.trim()) p.set("search", filters.search.trim())
    if (filters.categoryId && filters.categoryId !== "all")
      p.set("categoryId", filters.categoryId)
    if (filters.locationId && filters.locationId !== "all")
      p.set("locationId", filters.locationId)
    if (filters.from) p.set("from", filters.from)
    if (filters.to) p.set("to", filters.to)
    return p.toString()
  }, [filters])

  const inspectionsQuery = useQuery({
    queryKey: ["inspections", qs, refreshKey],
    queryFn: () =>
      apiFetch<{ inspections: InspectionListItem[] }>(
        `/api/inspections?${qs}`
      ).then((r) => r.inspections),
  })

  const categoriesQuery = useQuery({
    queryKey: ["categories", refreshKey],
    queryFn: () =>
      apiFetch<{ categories: CategoryOption[] }>(`/api/categories`).then(
        (r) => r.categories
      ),
  })

  const locationsQuery = useQuery({
    queryKey: ["locations", refreshKey],
    queryFn: () =>
      apiFetch<{ locations: LocationOption[] }>(`/api/locations`).then(
        (r) => r.locations
      ),
  })

  const detailQuery = useQuery({
    queryKey: ["inspection", selectedId, refreshKey],
    queryFn: () =>
      apiFetch<{ inspection: InspectionDetail }>(
        `/api/inspections/${selectedId}`
      ).then((r) => r.inspection),
    enabled: !!selectedId,
  })

  /* Locations filtered by selected category for dropdown */
  const locationsForDropdown = useMemo(() => {
    if (!locationsQuery.data) return []
    if (filters.categoryId === "all") return locationsQuery.data
    return locationsQuery.data.filter(
      (l) => l.categoryId === filters.categoryId
    )
  }, [locationsQuery.data, filters.categoryId])

  const inspections = inspectionsQuery.data ?? []

  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.categoryId !== "all" ||
    filters.locationId !== "all" ||
    filters.from !== "" ||
    filters.to !== ""

  function clearFilters() {
    setFilters({
      search: "",
      categoryId: "all",
      locationId: "all",
      from: "",
      to: "",
    })
  }

  /* ---- CSV export ---- */
  function exportCsv() {
    const rows = inspections
    if (rows.length === 0) {
      toast.error("Nothing to export")
      return
    }
    const headers = [
      "Date",
      "Time",
      "QR Code",
      "Location",
      "Machine",
      "Category",
      "Department",
      "Employee",
      "Employee Code",
      "Passed",
      "Failed",
      "N/A",
      "Score%",
      "Remarks",
    ]
    const lines = [headers.join(",")]
    for (const r of rows) {
      const d = new Date(r.inspectionDate)
      const cells = [
        formatDate(d),
        formatTime(d),
        r.location.qrCode,
        r.location.name,
        r.location.machineName,
        r.location.categoryName,
        r.location.departmentName ?? "",
        r.user.name,
        r.user.employeeCode ?? "",
        String(r.passedCount),
        String(r.failedCount),
        String(r.naCount),
        r.score.toFixed(1),
        (r.remarks ?? "").replace(/"/g, '""').replace(/\n/g, " "),
      ]
      lines.push(cells.map((c) => `"${c}"`).join(","))
    }
    const csv = lines.join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `inspections-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Exported ${rows.length} inspection${rows.length === 1 ? "" : "s"}`)
  }

  /* ---- Print handling ---- */
  useEffect(() => {
    if (!printMode) return
    const raf = requestAnimationFrame(() => window.print())
    const onAfter = () => setPrintMode(null)
    window.addEventListener("afterprint", onAfter)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("afterprint", onAfter)
    }
  }, [printMode])

  function printList() {
    if (inspections.length === 0) {
      toast.error("Nothing to print")
      return
    }
    setPrintMode("list")
  }

  function printDetail() {
    if (!detailQuery.data) return
    setPrintMode("detail")
  }

  /* ---- Summary for print ---- */
  const printSummary = useMemo(() => {
    const total = inspections.length
    const passed = inspections.filter((i) => i.failedCount === 0).length
    const failed = inspections.filter((i) => i.failedCount > 0).length
    const avg =
      total === 0
        ? 0
        : inspections.reduce((a, i) => a + i.score, 0) / total
    return { total, passed, failed, avg }
  }, [inspections])

  const filtersLabel = useMemo(() => {
    const parts: string[] = []
    if (filters.search.trim()) parts.push(`Search: "${filters.search.trim()}"`)
    if (filters.categoryId !== "all") {
      const cat = categoriesQuery.data?.find((c) => c.id === filters.categoryId)
      if (cat) parts.push(`Category: ${cat.name}`)
    }
    if (filters.locationId !== "all") {
      const loc = locationsQuery.data?.find((l) => l.id === filters.locationId)
      if (loc) parts.push(`Location: ${loc.name}`)
    }
    if (filters.from) parts.push(`From: ${formatDate(filters.from)}`)
    if (filters.to) parts.push(`To: ${formatDate(filters.to)}`)
    return parts.length ? parts.join(" · ") : "All inspections"
  }, [filters, categoriesQuery.data, locationsQuery.data])

  const detail = detailQuery.data

  return (
    <div className="space-y-4">
      {/* Page heading */}
      <div className="flex items-center gap-2 no-print">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">Inspection reports</h1>
      </div>

      {/* Filter bar */}
      <Card className="no-print">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4 text-primary" /> Filters
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  placeholder="Machine, QR, employee, remarks…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Category</label>
              <Select
                value={filters.categoryId}
                onValueChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    categoryId: v,
                    locationId: "all",
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categoriesQuery.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Location</label>
              <Select
                value={filters.locationId}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, locationId: v }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locationsForDropdown.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} ({l.qrCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">From date</label>
              <Input
                type="date"
                value={filters.from}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, from: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">To date</label>
              <Input
                type="date"
                value={filters.to}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, to: e.target.value }))
                }
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="ghost"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="w-full"
              >
                <X className="mr-2 h-4 w-4" /> Clear filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results header */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <p className="text-sm text-muted-foreground">
          {inspectionsQuery.isLoading
            ? "Loading…"
            : `${inspections.length} inspection${inspections.length === 1 ? "" : "s"} found`}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={inspections.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={printList}
            disabled={inspections.length === 0}
          >
            <Printer className="mr-2 h-4 w-4" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* List */}
      {inspectionsQuery.isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : inspections.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No inspections match your filters"
          description={
            hasActiveFilters
              ? "Try adjusting or clearing the filters."
              : "Once inspections are submitted they will appear here."
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" /> Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <div className="max-h-[32rem] overflow-auto scrollbar-thin">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Date / Time</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-center">Failed</TableHead>
                    <TableHead className="text-right">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspections.map((i) => {
                    const d = new Date(i.inspectionDate)
                    return (
                      <TableRow
                        key={i.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedId(i.id)}
                      >
                        <TableCell>
                          <div className="text-sm font-medium">
                            {formatDate(d)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatTime(d)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor: i.location.categoryColor,
                              }}
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {i.location.name}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {i.location.qrCode} · {i.location.machineName}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {i.location.categoryName}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{i.user.name}</div>
                          {i.user.employeeCode && (
                            <div className="text-xs text-muted-foreground">
                              {i.user.employeeCode}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <ScoreBadge score={i.score} />
                        </TableCell>
                        <TableCell className="text-center">
                          {i.failedCount > 0 ? (
                            <span className="inline-flex items-center rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
                              {i.failedCount}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              0
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedId(i.id)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View inspection</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {inspections.map((i) => (
              <MobileCard
                key={i.id}
                insp={i}
                onView={() => setSelectedId(i.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* Detail dialog */}
      <Dialog
        open={!!selectedId}
        onOpenChange={(o) => !o && setSelectedId(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>Inspection report</DialogTitle>
            <DialogDescription>
              Detailed checklist responses and metadata.
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : detail ? (
            <div className="space-y-4">
              {/* Header info */}
              <div className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">
                      {detail.location.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {detail.location.machineName} · {detail.location.qrCode}
                    </p>
                  </div>
                  <ScoreBadge score={detail.score} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <DetailMeta
                    icon={Tag}
                    label="Category"
                    value={detail.location.categoryName}
                    color={detail.location.categoryColor}
                  />
                  <DetailMeta
                    icon={Building2}
                    label="Department"
                    value={detail.location.departmentName ?? "—"}
                  />
                  <DetailMeta
                    icon={Calendar}
                    label="Date / Time"
                    value={formatDateTime(detail.inspectionDate)}
                  />
                  <DetailMeta
                    icon={UserIcon}
                    label="Employee"
                    value={
                      detail.user.name +
                      (detail.user.employeeCode
                        ? ` (${detail.user.employeeCode})`
                        : "")
                    }
                  />
                  {detail.checklist && (
                    <DetailMeta
                      icon={ClipboardList}
                      label="Checklist"
                      value={detail.checklist.name}
                    />
                  )}
                  <DetailMeta
                    icon={Hash}
                    label="Inspection ID"
                    value={detail.id.slice(-8).toUpperCase()}
                  />
                </div>
              </div>

              {/* Counts */}
              <div className="grid grid-cols-3 gap-2">
                <CountCell
                  label="OK"
                  value={detail.passedCount}
                  cls="emerald"
                />
                <CountCell
                  label="Not OK"
                  value={detail.failedCount}
                  cls="red"
                />
                <CountCell label="N/A" value={detail.naCount} cls="zinc" />
              </div>

              {/* Responses */}
              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  Checklist responses
                </h4>
                <div className="max-h-72 overflow-y-auto scrollbar-thin rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Photo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.responses.map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm font-medium">
                            {r.item}
                          </TableCell>
                          <TableCell>
                            <StatusPill status={r.status} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {r.reason ?? "—"}
                          </TableCell>
                          <TableCell>
                            {r.photoUrl ? (
                              <a
                                href={r.photoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Photo for ${r.item} — opens in new tab`}
                              >
                                <img
                                  src={r.photoUrl}
                                  alt={`Photo for ${r.item}`}
                                  className="h-12 w-12 rounded border object-cover"
                                />
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Remarks */}
              {detail.remarks && (
                <div>
                  <h4 className="mb-1 text-sm font-semibold">Remarks</h4>
                  <p className="rounded-lg border bg-muted/30 p-3 text-sm">
                    {detail.remarks}
                  </p>
                </div>
              )}

              {/* Overall photo */}
              {detail.photoUrl && (
                <div>
                  <h4 className="mb-1 text-sm font-semibold">Overall photo</h4>
                  <a
                    href={detail.photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Overall inspection photo — opens in new tab"
                  >
                    <img
                      src={detail.photoUrl}
                      alt="Overall inspection photo"
                      className="max-h-64 rounded-lg border"
                    />
                  </a>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={printDetail}>
                  <Printer className="mr-2 h-4 w-4" /> Print this report
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Failed to load inspection.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Print area — driven by printMode */}
      {printMode === "list" && (
        <div className="print-area fixed -left-[9999px] top-0 print:static print:left-0">
          <div className="p-8 text-black">
            <div className="mb-6 border-b border-gray-300 pb-4">
              <h1 className="text-2xl font-bold">
                SQLMS — Inspection Report
              </h1>
              <p className="text-sm text-gray-700">
                Plant Operations · Generated {formatDateTime(new Date())}
              </p>
              <p className="mt-1 text-xs text-gray-600">
                Filters: {filtersLabel}
              </p>
            </div>
            <div className="mb-4 grid grid-cols-4 gap-3 text-sm">
              <div className="rounded border border-gray-300 p-2">
                <p className="text-xs text-gray-600">Total</p>
                <p className="text-lg font-bold">{printSummary.total}</p>
              </div>
              <div className="rounded border border-gray-300 p-2">
                <p className="text-xs text-gray-600">Passed (no fails)</p>
                <p className="text-lg font-bold text-emerald-700">
                  {printSummary.passed}
                </p>
              </div>
              <div className="rounded border border-gray-300 p-2">
                <p className="text-xs text-gray-600">With failures</p>
                <p className="text-lg font-bold text-red-700">
                  {printSummary.failed}
                </p>
              </div>
              <div className="rounded border border-gray-300 p-2">
                <p className="text-xs text-gray-600">Avg score</p>
                <p className="text-lg font-bold">
                  {printSummary.avg.toFixed(1)}%
                </p>
              </div>
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">Date</th>
                  <th className="border border-gray-300 p-2 text-left">Time</th>
                  <th className="border border-gray-300 p-2 text-left">QR</th>
                  <th className="border border-gray-300 p-2 text-left">
                    Location
                  </th>
                  <th className="border border-gray-300 p-2 text-left">
                    Machine
                  </th>
                  <th className="border border-gray-300 p-2 text-left">
                    Category
                  </th>
                  <th className="border border-gray-300 p-2 text-left">
                    Department
                  </th>
                  <th className="border border-gray-300 p-2 text-left">
                    Employee
                  </th>
                  <th className="border border-gray-300 p-2 text-center">OK</th>
                  <th className="border border-gray-300 p-2 text-center">
                    Fail
                  </th>
                  <th className="border border-gray-300 p-2 text-center">N/A</th>
                  <th className="border border-gray-300 p-2 text-center">
                    Score
                  </th>
                  <th className="border border-gray-300 p-2 text-left">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((i) => {
                  const d = new Date(i.inspectionDate)
                  return (
                    <tr key={i.id}>
                      <td className="border border-gray-300 p-2">
                        {formatDate(d)}
                      </td>
                      <td className="border border-gray-300 p-2">
                        {formatTime(d)}
                      </td>
                      <td className="border border-gray-300 p-2">
                        {i.location.qrCode}
                      </td>
                      <td className="border border-gray-300 p-2">
                        {i.location.name}
                      </td>
                      <td className="border border-gray-300 p-2">
                        {i.location.machineName}
                      </td>
                      <td className="border border-gray-300 p-2">
                        {i.location.categoryName}
                      </td>
                      <td className="border border-gray-300 p-2">
                        {i.location.departmentName ?? ""}
                      </td>
                      <td className="border border-gray-300 p-2">
                        {i.user.name}
                        {i.user.employeeCode ? ` (${i.user.employeeCode})` : ""}
                      </td>
                      <td className="border border-gray-300 p-2 text-center">
                        {i.passedCount}
                      </td>
                      <td className="border border-gray-300 p-2 text-center">
                        {i.failedCount}
                      </td>
                      <td className="border border-gray-300 p-2 text-center">
                        {i.naCount}
                      </td>
                      <td className="border border-gray-300 p-2 text-center">
                        {i.score.toFixed(1)}%
                      </td>
                      <td className="border border-gray-300 p-2">
                        {i.remarks ?? ""}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-gray-600">
              Generated by SQLMS · Smart QR Logbook Management System
            </p>
          </div>
        </div>
      )}

      {printMode === "detail" && detail && (
        <div className="print-area fixed -left-[9999px] top-0 print:static print:left-0">
          <div className="p-8 text-black">
            <div className="mb-6 border-b border-gray-300 pb-4">
              <h1 className="text-2xl font-bold">
                SQLMS — Inspection Report
              </h1>
              <p className="text-sm text-gray-700">
                Plant Operations · Generated {formatDateTime(new Date())}
              </p>
            </div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">{detail.location.name}</h2>
              <p className="text-sm text-gray-700">
                {detail.location.machineName} · {detail.location.qrCode}
              </p>
              <p className="text-sm text-gray-700">
                Category: {detail.location.categoryName} · Department:{" "}
                {detail.location.departmentName ?? "—"}
              </p>
              <p className="text-sm text-gray-700">
                Employee: {detail.user.name}
                {detail.user.employeeCode
                  ? ` (${detail.user.employeeCode})`
                  : ""}
              </p>
              <p className="text-sm text-gray-700">
                Date: {formatDateTime(detail.inspectionDate)}
              </p>
              <p className="text-sm text-gray-700">
                Score: {detail.score.toFixed(1)}% · OK: {detail.passedCount} ·
                Not OK: {detail.failedCount} · N/A: {detail.naCount}
              </p>
              {detail.checklist && (
                <p className="text-sm text-gray-700">
                  Checklist: {detail.checklist.name}
                </p>
              )}
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">#</th>
                  <th className="border border-gray-300 p-2 text-left">Item</th>
                  <th className="border border-gray-300 p-2 text-left">
                    Status
                  </th>
                  <th className="border border-gray-300 p-2 text-left">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody>
                {detail.responses.map((r, idx) => (
                  <tr key={idx}>
                    <td className="border border-gray-300 p-2">{idx + 1}</td>
                    <td className="border border-gray-300 p-2">{r.item}</td>
                    <td className="border border-gray-300 p-2">
                      {STATUS_META[r.status].label}
                    </td>
                    <td className="border border-gray-300 p-2">
                      {r.reason ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.remarks && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold">Remarks</h3>
                <p className="text-sm">{detail.remarks}</p>
              </div>
            )}
            <p className="mt-6 text-xs text-gray-600">
              Generated by SQLMS · Smart QR Logbook Management System
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
