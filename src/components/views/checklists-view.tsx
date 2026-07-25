"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Plus,
  ListChecks,
  Pencil,
  Trash2,
  Loader2,
  X,
  MapPin,
  ClipboardCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
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
import { apiFetch } from "@/lib/api-client"
import { FREQUENCIES, frequencyLabel } from "@/lib/constants"
import { useAppStore } from "@/store/app-store"
import { EmptyState } from "@/components/empty-state"
import { CategoryBadge } from "@/components/category-badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/* ----------------------------- API types ----------------------------- */
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

/* ----------------------------- Form state ----------------------------- */
interface FormState {
  name: string
  categoryId: string
  frequency: string
  description: string
  items: string[]
  active: boolean
}

const EMPTY_FORM: FormState = {
  name: "",
  categoryId: "",
  frequency: "DAILY",
  description: "",
  items: [""],
  active: true,
}

/* ----------------------------- View ----------------------------- */
export function ChecklistsView() {
  const refreshKey = useAppStore((s) => s.refreshKey)
  const bump = useAppStore((s) => s.bump)
  const queryClient = useQueryClient()

  const checklistsQ = useQuery({
    queryKey: ["checklists", refreshKey],
    queryFn: () => apiFetch<{ checklists: Checklist[] }>("/api/checklists"),
  })
  const categoriesQ = useQuery({
    queryKey: ["categories", refreshKey],
    queryFn: () => apiFetch<{ categories: Category[] }>("/api/categories"),
  })

  const checklists = checklistsQ.data?.checklists ?? []
  const categories = categoriesQ.data?.categories ?? []

  /* Dialogs */
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Checklist | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Checklist | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sorted = useMemo(
    () => [...checklists].sort((a, b) => a.name.localeCompare(b.name)),
    [checklists]
  )

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(cl: Checklist) {
    setEditing(cl)
    setForm({
      name: cl.name,
      categoryId: cl.categoryId,
      frequency: cl.frequency,
      description: cl.description ?? "",
      items: cl.items.length > 0 ? [...cl.items] : [""],
      active: cl.active,
    })
    setFormOpen(true)
  }

  function setItem(idx: number, value: string) {
    setForm((f) => {
      const items = [...f.items]
      items[idx] = value
      return { ...f, items }
    })
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, ""] }))
  }

  function removeItem(idx: number) {
    setForm((f) => ({
      ...f,
      items: f.items.length === 1 ? [""] : f.items.filter((_, i) => i !== idx),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleanedItems = form.items.map((i) => i.trim()).filter(Boolean)
    if (!form.name.trim() || !form.categoryId) {
      toast.error("Name and category are required")
      return
    }
    if (cleanedItems.length === 0) {
      toast.error("At least one checklist item is required")
      return
    }
    setSubmitting(true)
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      categoryId: form.categoryId,
      frequency: form.frequency,
      description: form.description.trim() || null,
      items: cleanedItems,
    }
    if (editing) payload.active = form.active
    try {
      if (editing) {
        await apiFetch(`/api/checklists/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })
        toast.success("Checklist updated")
      } else {
        await apiFetch("/api/checklists", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        toast.success("Checklist created")
      }
      bump()
      void queryClient.invalidateQueries({ queryKey: ["checklists"] })
      setFormOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save checklist")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiFetch(`/api/checklists/${deleteTarget.id}`, { method: "DELETE" })
      toast.success("Checklist deleted")
      bump()
      void queryClient.invalidateQueries({ queryKey: ["checklists"] })
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete checklist")
    } finally {
      setDeleting(false)
    }
  }

  const isLoading = checklistsQ.isLoading

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <ListChecks className="h-5 w-5 text-primary" />
              Checklists
            </h2>
            <p className="text-sm text-muted-foreground">
              One application, unlimited checklists. Define inspection items per category.
            </p>
          </div>
          <Badge variant="secondary" className="h-6">
            {checklists.length}
          </Badge>
        </div>
        <Button onClick={openCreate} className="self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          New Checklist
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No checklists yet"
          description="Create your first checklist to define what inspectors verify at each location."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New Checklist
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sorted.map((cl) => (
            <ChecklistCard
              key={cl.id}
              cl={cl}
              onEdit={() => openEdit(cl)}
              onDelete={() => setDeleteTarget(cl)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => !submitting && setFormOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Checklist" : "New Checklist"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update checklist details and inspection items."
                : "Define a checklist with the items inspectors will verify."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cl-name">Checklist Name *</Label>
              <Input
                id="cl-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Machine Daily Checklist"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cl-category">Category *</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => setForm({ ...form, categoryId: v })}
                >
                  <SelectTrigger id="cl-category" className="w-full">
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
              <div className="space-y-2">
                <Label htmlFor="cl-freq">Frequency</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) => setForm({ ...form, frequency: v })}
                >
                  <SelectTrigger id="cl-freq" className="w-full">
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
              <Label htmlFor="cl-desc">Description</Label>
              <Textarea
                id="cl-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Standard daily machine inspection checklist"
                rows={2}
              />
            </div>

            {/* Items editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Inspection Items *
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({form.items.filter((i) => i.trim()).length})
                  </span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                  className="h-7"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add item
                </Button>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto scrollbar-thin rounded-md border p-2">
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">
                      {idx + 1}.
                    </span>
                    <Input
                      value={item}
                      onChange={(e) => setItem(idx, e.target.value)}
                      placeholder={`Inspection item ${idx + 1}`}
                      aria-label={`Inspection item ${idx + 1}`}
                      className="h-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(idx)}
                      aria-label={`Remove item ${idx + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {form.items.length === 0 && (
                  <p className="p-2 text-center text-xs text-muted-foreground">
                    No items. Click &quot;Add item&quot; to begin.
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                At least one non-empty item is required. Empty rows are ignored on save.
              </p>
            </div>

            {editing && (
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="cl-active" className="cursor-pointer text-sm">
                  Active (assignable to locations)
                </Label>
                <Switch
                  id="cl-active"
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
                {editing ? "Save changes" : "Create checklist"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !deleting && !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete checklist?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <span>
                This will permanently delete{" "}
                <span className="font-medium text-foreground">{deleteTarget?.name}</span>.
                {deleteTarget && deleteTarget.locationCount > 0 && (
                  <span className="mt-2 block rounded-md border border-amber-500/40 bg-amber-50 p-2 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    ⚠ This checklist is currently used by {deleteTarget.locationCount}{" "}
                    location{deleteTarget.locationCount === 1 ? "" : "s"}. Deleting it will
                    detach it from those locations.
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

/* ----------------------------- Checklist card ----------------------------- */
function ChecklistCard({
  cl,
  onEdit,
  onDelete,
}: {
  cl: Checklist
  onEdit: () => void
  onDelete: () => void
}) {
  const previewItems = cl.items.slice(0, 4)
  const extra = cl.items.length - previewItems.length

  return (
    <Card className="gap-0 p-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0 flex-1 space-y-2">
          <CategoryBadge
            icon="ClipboardCheck"
            color={cl.categoryColor}
            name={cl.categoryName}
            size="sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 text-primary">
              {frequencyLabel(cl.frequency)}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                cl.active
                  ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                  : "border-red-500/40 text-red-700 dark:text-red-400"
              )}
            >
              {cl.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onEdit}
            aria-label={`Edit ${cl.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
            aria-label={`Delete ${cl.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-3 p-4">
        <div>
          <p className="font-semibold">{cl.name}</p>
          {cl.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {cl.description}
            </p>
          ) : (
            <p className="mt-1 text-sm italic text-muted-foreground">No description</p>
          )}
        </div>

        {/* Item preview */}
        <div className="flex flex-wrap gap-1.5">
          {previewItems.map((it, i) => (
            <Badge key={i} variant="secondary" className="gap-1 font-normal">
              <ClipboardCheck className="h-3 w-3 text-primary" />
              {it}
            </Badge>
          ))}
          {extra > 0 && (
            <Badge variant="outline" className="text-muted-foreground">
              +{extra} more
            </Badge>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t bg-muted/30 p-3 text-xs">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <ClipboardCheck className="h-3.5 w-3.5" />
          {cl.items.length} item{cl.items.length === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          Used by {cl.locationCount} location{cl.locationCount === 1 ? "" : "s"}
        </span>
      </div>
    </Card>
  )
}
