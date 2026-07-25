"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Plus,
  Search,
  MapPin,
  Pencil,
  Trash2,
  QrCode as QrCodeIcon,
  Download,
  Printer,
  ExternalLink,
  Loader2,
  ClipboardList,
  Building2,
  Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { apiFetch, formatDate } from "@/lib/api-client"
import { FREQUENCIES, frequencyLabel } from "@/lib/constants"
import { useAppStore } from "@/store/app-store"
import { EmptyState } from "@/components/empty-state"
import { CategoryBadge } from "@/components/category-badge"
import { QrCode, downloadQrPng } from "@/components/qr-code"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/* ----------------------------- API types ----------------------------- */
interface Location {
  id: string
  qrCode: string
  name: string
  machineName: string
  frequency: string
  active: boolean
  categoryId: string
  categoryName: string
  categoryColor: string
  categoryIcon: string
  departmentId: string | null
  departmentName: string | null
  checklistId: string | null
  checklistName: string | null
  inspectionCount: number
  createdAt: string
}

interface Category {
  id: string
  name: string
  slug: string
  icon: string
  color: string
  description: string | null
  locationCount: number
  checklistCount: number
}

interface Department {
  id: string
  name: string
  description: string | null
  userCount: number
  locationCount: number
}

interface Checklist {
  id: string
  name: string
  description: string | null
  frequency: string
  items: string[]
  active: boolean
  categoryId: string
  categoryName: string
  categoryColor: string
  locationCount: number
}

/* ----------------------------- Form state ----------------------------- */
interface FormState {
  name: string
  machineName: string
  categoryId: string
  departmentId: string
  checklistId: string
  frequency: string
  active: boolean
}

const EMPTY_FORM: FormState = {
  name: "",
  machineName: "",
  categoryId: "",
  departmentId: "none",
  checklistId: "none",
  frequency: "DAILY",
  active: true,
}

/* ----------------------------- View ----------------------------- */
export function LocationsView() {
  const refreshKey = useAppStore((s) => s.refreshKey)
  const bump = useAppStore((s) => s.bump)
  const queryClient = useQueryClient()

  const locationsQ = useQuery({
    queryKey: ["locations", refreshKey],
    queryFn: () => apiFetch<{ locations: Location[] }>("/api/locations"),
  })
  const categoriesQ = useQuery({
    queryKey: ["categories", refreshKey],
    queryFn: () => apiFetch<{ categories: Category[] }>("/api/categories"),
  })
  const departmentsQ = useQuery({
    queryKey: ["departments", refreshKey],
    queryFn: () => apiFetch<{ departments: Department[] }>("/api/departments"),
  })
  const checklistsQ = useQuery({
    queryKey: ["checklists", refreshKey],
    queryFn: () => apiFetch<{ checklists: Checklist[] }>("/api/checklists"),
  })

  const locations = locationsQ.data?.locations ?? []
  const categories = categoriesQ.data?.categories ?? []
  const departments = departmentsQ.data?.departments ?? []
  const checklists = checklistsQ.data?.checklists ?? []

  /* Filters */
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")
  const [activeOnly, setActiveOnly] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return locations.filter((l) => {
      if (activeOnly && !l.active) return false
      if (categoryFilter !== "all" && l.categoryId !== categoryFilter) return false
      if (departmentFilter !== "all") {
        const matchDept = departmentFilter === "none" ? !l.departmentId : l.departmentId === departmentFilter
        if (!matchDept) return false
      }
      if (!q) return true
      return (
        l.name.toLowerCase().includes(q) ||
        l.machineName.toLowerCase().includes(q) ||
        l.qrCode.toLowerCase().includes(q)
      )
    })
  }, [locations, search, categoryFilter, departmentFilter, activeOnly])

  /* Dialogs */
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Location | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const [qrDetail, setQrDetail] = useState<Location | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null)
  const [deleting, setDeleting] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(loc: Location) {
    setEditing(loc)
    setForm({
      name: loc.name,
      machineName: loc.machineName,
      categoryId: loc.categoryId,
      departmentId: loc.departmentId ?? "none",
      checklistId: loc.checklistId ?? "none",
      frequency: loc.frequency,
      active: loc.active,
    })
    setFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.machineName.trim() || !form.categoryId) {
      toast.error("Name, machine name and category are required")
      return
    }
    setSubmitting(true)
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      machineName: form.machineName.trim(),
      categoryId: form.categoryId,
      frequency: form.frequency,
      departmentId: form.departmentId === "none" ? null : form.departmentId,
      checklistId: form.checklistId === "none" ? null : form.checklistId,
    }
    if (editing) payload.active = form.active
    try {
      if (editing) {
        await apiFetch(`/api/locations/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })
        toast.success("Location updated")
      } else {
        const res = await apiFetch<{ location: { qrCode: string; name: string } }>(
          "/api/locations",
          { method: "POST", body: JSON.stringify(payload) }
        )
        toast.success(`Location created · QR ${res.location.qrCode}`, {
          description: res.location.name,
        })
      }
      bump()
      void queryClient.invalidateQueries({ queryKey: ["locations"] })
      setFormOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save location")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiFetch(`/api/locations/${deleteTarget.id}`, { method: "DELETE" })
      toast.success("Location deleted")
      bump()
      void queryClient.invalidateQueries({ queryKey: ["locations"] })
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete location")
    } finally {
      setDeleting(false)
    }
  }

  /* Filtered checklists for the selected category (in form) */
  const formChecklists = useMemo(
    () => (form.categoryId ? checklists.filter((c) => c.categoryId === form.categoryId) : []),
    [checklists, form.categoryId]
  )

  const isLoading = locationsQ.isLoading

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <MapPin className="h-5 w-5 text-primary" />
              QR Locations
            </h2>
            <p className="text-sm text-muted-foreground">
              Generate and manage QR codes for every inspection point.
            </p>
          </div>
          <Badge variant="secondary" className="h-6">
            {locations.length}
          </Badge>
        </div>
        <Button onClick={openCreate} className="self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          Add New Location
        </Button>
      </div>

      {/* Filter bar */}
      <Card className="gap-3 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative md:col-span-2 xl:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, machine or QR…"
              className="pl-9"
              aria-label="Search locations"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full" aria-label="Filter by category">
              <Filter className="mr-1 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full" aria-label="Filter by department">
              <Building2 className="mr-1 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              <SelectItem value="none">No department</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="active-only" className="cursor-pointer text-sm">
              Active only
            </Label>
            <Switch
              id="active-only"
              checked={activeOnly}
              onCheckedChange={setActiveOnly}
              aria-label="Show active locations only"
            />
          </div>
        </div>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={locations.length === 0 ? "No locations yet" : "No matching locations"}
          description={
            locations.length === 0
              ? "Create your first QR location to start tracking inspections."
              : "Try adjusting the search or filters."
          }
          action={
            locations.length === 0 ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add New Location
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setCategoryFilter("all")
                  setDepartmentFilter("all")
                  setActiveOnly(false)
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((loc) => (
            <LocationCard
              key={loc.id}
              loc={loc}
              onViewQr={() => setQrDetail(loc)}
              onEdit={() => openEdit(loc)}
              onDelete={() => setDeleteTarget(loc)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => !submitting && setFormOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Location" : "Add New Location"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the location details. The QR code stays the same."
                : "Fill in the details — a unique QR code will be generated automatically."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="loc-name">Location Name *</Label>
                <Input
                  id="loc-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Slitting Line"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-machine">Machine Name *</Label>
                <Input
                  id="loc-machine"
                  value={form.machineName}
                  onChange={(e) => setForm({ ...form, machineName: e.target.value })}
                  placeholder="Slitter-01"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="loc-category">Category *</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm({ ...form, categoryId: v, checklistId: "none" })}
              >
                <SelectTrigger id="loc-category" className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="loc-dept">Department</Label>
                <Select
                  value={form.departmentId}
                  onValueChange={(v) => setForm({ ...form, departmentId: v })}
                >
                  <SelectTrigger id="loc-dept" className="w-full">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No department —</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-freq">Frequency</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) => setForm({ ...form, frequency: v })}
                >
                  <SelectTrigger id="loc-freq" className="w-full">
                    <SelectValue placeholder="Frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="loc-checklist">Checklist (optional)</Label>
              <Select
                value={form.checklistId}
                onValueChange={(v) => setForm({ ...form, checklistId: v })}
                disabled={!form.categoryId || formChecklists.length === 0}
              >
                <SelectTrigger id="loc-checklist" className="w-full">
                  <SelectValue
                    placeholder={
                      !form.categoryId
                        ? "Select a category first"
                        : formChecklists.length === 0
                          ? "No checklists for this category"
                          : "Select checklist"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No checklist —</SelectItem>
                  {formChecklists.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editing && (
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="loc-active" className="cursor-pointer text-sm">
                  Active (available for inspection)
                </Label>
                <Switch
                  id="loc-active"
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Create location"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR detail dialog */}
      <Dialog open={!!qrDetail} onOpenChange={(o) => !o && setQrDetail(null)}>
        <DialogContent className="sm:max-w-md">
          {qrDetail && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <QrCodeIcon className="h-5 w-5 text-primary" />
                  QR Code Details
                </DialogTitle>
                <DialogDescription>
                  Print, download, or share this QR code for the inspection point.
                </DialogDescription>
              </DialogHeader>

              {/* Printable QR card */}
              <div className="print-area mx-auto w-full max-w-xs rounded-xl border bg-white p-5 text-center text-slate-900">
                <div className="mb-2 flex items-center justify-center gap-2">
                  <CategoryBadge
                    icon={qrDetail.categoryIcon}
                    color={qrDetail.categoryColor}
                    name={qrDetail.categoryName}
                    size="sm"
                  />
                </div>
                <div className="flex justify-center">
                  <QrCode value={qrDetail.qrCode} size={200} />
                </div>
                <p className="mt-3 text-lg font-bold">{qrDetail.name}</p>
                <p className="text-sm text-slate-600">{qrDetail.machineName}</p>
                <p className="mt-1 font-mono text-base tracking-wider">{qrDetail.qrCode}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Scan to open inspection checklist
                </p>
              </div>

              <div className="no-print space-y-3">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Badge variant="outline">{frequencyLabel(qrDetail.frequency)}</Badge>
                  <Badge
                    variant="outline"
                    className={
                      qrDetail.active
                        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                        : "border-red-500/40 text-red-700 dark:text-red-400"
                    }
                  >
                    {qrDetail.active ? "Active" : "Inactive"}
                  </Badge>
                  {qrDetail.departmentName && (
                    <Badge variant="outline" className="gap-1">
                      <Building2 className="h-3 w-3" />
                      {qrDetail.departmentName}
                    </Badge>
                  )}
                  {qrDetail.checklistName && (
                    <Badge variant="outline" className="gap-1">
                      <ClipboardList className="h-3 w-3" />
                      {qrDetail.checklistName}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <code className="flex-1 truncate text-xs">
                    {typeof window !== "undefined" ? window.location.origin : ""}/?qr=
                    {qrDetail.qrCode}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => {
                      const url = `${window.location.origin}/?qr=${qrDetail.qrCode}`
                      navigator.clipboard?.writeText(url)
                      toast.success("Link copied")
                    }}
                  >
                    Copy
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      downloadQrPng(
                        qrDetail.qrCode,
                        `${qrDetail.qrCode}-${qrDetail.machineName}.png`
                      )
                    }
                  >
                    <Download className="h-4 w-4" />
                    Download PNG
                  </Button>
                  <Button type="button" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !deleting && !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete location?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <span>
                This will permanently delete{" "}
                <span className="font-medium text-foreground">
                  {deleteTarget?.name}
                </span>{" "}
                ({deleteTarget?.qrCode}). This action cannot be undone.
                {deleteTarget && deleteTarget.inspectionCount > 0 && (
                  <span className="mt-2 block rounded-md border border-amber-500/40 bg-amber-50 p-2 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    ⚠ This location has {deleteTarget.inspectionCount} recorded inspection
                    {deleteTarget.inspectionCount === 1 ? "" : "s"}. Deleting it will also
                    remove associated inspection history.
                  </span>
                )}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ----------------------------- Location card ----------------------------- */
function LocationCard({
  loc,
  onViewQr,
  onEdit,
  onDelete,
}: {
  loc: Location
  onViewQr: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <CategoryBadge
            icon={loc.categoryIcon}
            color={loc.categoryColor}
            name={loc.categoryName}
            size="sm"
          />
          <Badge variant="outline" className="border-primary/30 text-primary">
            {frequencyLabel(loc.frequency)}
          </Badge>
        </div>
        <button
          type="button"
          onClick={onViewQr}
          className="rounded-lg transition hover:ring-2 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`View QR code for ${loc.name}`}
        >
          <QrCode value={loc.qrCode} size={88} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-2 p-4">
        <div>
          <p className="truncate font-semibold">{loc.name}</p>
          <p className="truncate text-sm text-muted-foreground">{loc.machineName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono tracking-wider">
            {loc.qrCode}
          </code>
          {loc.departmentName ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {loc.departmentName}
            </span>
          ) : (
            <span className="text-muted-foreground">No department</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="secondary" className="gap-1">
            <ClipboardList className="h-3 w-3" />
            {loc.inspectionCount} inspection{loc.inspectionCount === 1 ? "" : "s"}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              loc.active
                ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                : "border-red-500/40 text-red-700 dark:text-red-400"
            )}
          >
            {loc.active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onViewQr}
            aria-label={`View QR for ${loc.name}`}
          >
            <QrCodeIcon className="h-4 w-4" />
            <span className="hidden sm:inline">View QR</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onEdit}
            aria-label={`Edit ${loc.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
            aria-label={`Delete ${loc.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="px-4 pb-3 text-[10px] text-muted-foreground">
        Created {formatDate(loc.createdAt)}
      </p>
    </Card>
  )
}
