"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  ListChecks,
  Users,
  Loader2,
  Tags,
  Building2,
  Palette,
} from "lucide-react"

import { apiFetch } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"
import { EmptyState } from "@/components/empty-state"
import { CategoryBadge } from "@/components/category-badge"
import { getIcon } from "@/lib/icons"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/* ------------------------------ Types ------------------------------ */
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

interface CategoriesResponse {
  categories: Category[]
}
interface DepartmentsResponse {
  departments: Department[]
}

/* ----------------------------- Constants ----------------------------- */
const ICON_OPTIONS = [
  "Cog",
  "Sparkles",
  "ShieldCheck",
  "Zap",
  "Fuel",
  "Warehouse",
  "BadgeCheck",
  "Tag",
  "Factory",
  "Wrench",
  "Tractor",
  "Flame",
  "Gauge",
  "Boxes",
  "ClipboardCheck",
] as const

const COLOR_PRESETS = [
  "#0d9488", // teal
  "#0891b2", // cyan
  "#dc2626", // red
  "#ca8a04", // yellow
  "#9333ea", // purple
  "#16a34a", // green
  "#ea580c", // orange
  "#db2777", // pink
  "#475569", // slate
] as const

/* ----------------------------- Component ----------------------------- */
export function CategoriesView() {
  return (
    <Tabs defaultValue="categories" className="gap-4">
      <TabsList>
        <TabsTrigger value="categories" className="gap-1.5">
          <Tags className="h-4 w-4" /> Categories
        </TabsTrigger>
        <TabsTrigger value="departments" className="gap-1.5">
          <Building2 className="h-4 w-4" /> Departments
        </TabsTrigger>
      </TabsList>
      <TabsContent value="categories">
        <CategoriesTab />
      </TabsContent>
      <TabsContent value="departments">
        <DepartmentsTab />
      </TabsContent>
    </Tabs>
  )
}

/* --------------------------- Categories tab --------------------------- */
function CategoriesTab() {
  const refreshKey = useAppStore((s) => s.refreshKey)
  const bump = useAppStore((s) => s.bump)

  const { data, isLoading, isError, error } = useQuery<CategoriesResponse>({
    queryKey: ["categories", refreshKey],
    queryFn: () => apiFetch<CategoriesResponse>("/api/categories"),
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<{
    name: string
    description: string
    icon: string
    color: string
  }>({ name: "", description: "", icon: "Cog", color: "#0d9488" })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        icon: form.icon,
        color: form.color,
      }
      if (editing) {
        await apiFetch(`/api/categories/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        })
      } else {
        await apiFetch("/api/categories", {
          method: "POST",
          body: JSON.stringify(body),
        })
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Category updated" : "Category created")
      setDialogOpen(false)
      setEditing(null)
      bump()
    },
    onError: (err: Error) =>
      toast.error(err instanceof Error ? err.message : "Failed to save category"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Category deleted")
      setDeleteId(null)
      bump()
    },
    onError: (err: Error) =>
      toast.error(err instanceof Error ? err.message : "Failed to delete category"),
  })

  function openAdd() {
    setEditing(null)
    setForm({ name: "", description: "", icon: "Cog", color: "#0d9488" })
    setDialogOpen(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setForm({
      name: cat.name,
      description: cat.description ?? "",
      icon: cat.icon,
      color: cat.color,
    })
    setDialogOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    saveMutation.mutate()
  }

  const categories = data?.categories ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inspection Categories</h2>
          <p className="text-sm text-muted-foreground">
            Group QR locations and checklists
          </p>
        </div>
        <Button onClick={openAdd} className="w-fit">
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={Tags}
          title="Failed to load categories"
          description={
            error instanceof Error ? error.message : "Please try again later."
          }
        />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Create your first inspection category to group QR locations and checklists."
          action={
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Category
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <Card key={cat.id} className="gap-3 p-4">
              <div className="flex items-start gap-3">
                <CategoryBadge icon={cat.icon} color={cat.color} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{cat.name}</h3>
                    <span
                      className="h-3 w-3 shrink-0 rounded-full ring-2 ring-background"
                      style={{ backgroundColor: cat.color }}
                      aria-hidden
                      title={cat.color}
                    />
                  </div>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {cat.slug}
                  </p>
                </div>
              </div>

              {cat.description ? (
                <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                  {cat.description}
                </p>
              ) : (
                <p className="min-h-[2.5rem] text-sm italic text-muted-foreground/60">
                  No description
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <MapPin className="h-3 w-3" /> {cat.locationCount}{" "}
                  {cat.locationCount === 1 ? "location" : "locations"}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <ListChecks className="h-3 w-3" /> {cat.checklistCount}{" "}
                  {cat.checklistCount === 1 ? "checklist" : "checklists"}
                </Badge>
              </div>

              <div className="mt-auto flex items-center gap-1 border-t pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(cat)}
                  aria-label={`Edit ${cat.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(cat.id)}
                  aria-label={`Delete ${cat.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) setEditing(null)
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Category" : "Add Category"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the category details below."
                : "Create a new inspection category."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Live preview */}
            <div className="flex flex-col items-center justify-center gap-1 rounded-lg border bg-muted/30 py-5">
              <CategoryBadge
                icon={form.icon}
                color={form.color}
                size="md"
                name={form.name.trim() || "Preview"}
              />
              <p className="text-[11px] text-muted-foreground">Live preview</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Machine"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Short description of this category"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-icon">Icon</Label>
              <Select
                value={form.icon}
                onValueChange={(v) => setForm((f) => ({ ...f, icon: v }))}
              >
                <SelectTrigger id="cat-icon" className="w-full">
                  <SelectValue placeholder="Select icon" />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((name) => {
                    const I = getIcon(name)
                    return (
                      <SelectItem key={name} value={name}>
                        <span className="flex items-center gap-2">
                          <I className="h-4 w-4" /> {name}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map((hex) => {
                  const active =
                    form.color.toLowerCase() === hex.toLowerCase()
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, color: hex }))}
                      aria-label={`Select color ${hex}`}
                      aria-pressed={active}
                      className={cn(
                        "h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition",
                        active
                          ? "ring-foreground"
                          : "ring-transparent hover:ring-muted-foreground/40"
                      )}
                      style={{ backgroundColor: hex }}
                    />
                  )
                })}
                <div className="relative ml-1 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground">
                  <Palette className="h-3.5 w-3.5" />
                  <span className="font-mono uppercase">{form.color}</span>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, color: e.target.value }))
                    }
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Pick custom color"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saveMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {editing ? "Save Changes" : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the category. Locations and
              checklists using it may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (deleteId) deleteMutation.mutate(deleteId)
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* --------------------------- Departments tab --------------------------- */
function DepartmentsTab() {
  const refreshKey = useAppStore((s) => s.refreshKey)
  const bump = useAppStore((s) => s.bump)

  const { data, isLoading, isError, error } = useQuery<DepartmentsResponse>({
    queryKey: ["departments", refreshKey],
    queryFn: () => apiFetch<DepartmentsResponse>("/api/departments"),
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [form, setForm] = useState<{ name: string; description: string }>({
    name: "",
    description: "",
  })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      }
      if (editing) {
        await apiFetch(`/api/departments/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        })
      } else {
        await apiFetch("/api/departments", {
          method: "POST",
          body: JSON.stringify(body),
        })
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Department updated" : "Department created")
      setDialogOpen(false)
      setEditing(null)
      bump()
    },
    onError: (err: Error) =>
      toast.error(err instanceof Error ? err.message : "Failed to save department"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/departments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Department deleted")
      setDeleteId(null)
      bump()
    },
    onError: (err: Error) =>
      toast.error(err instanceof Error ? err.message : "Failed to delete department"),
  })

  function openAdd() {
    setEditing(null)
    setForm({ name: "", description: "" })
    setDialogOpen(true)
  }

  function openEdit(d: Department) {
    setEditing(d)
    setForm({ name: d.name, description: d.description ?? "" })
    setDialogOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    saveMutation.mutate()
  }

  const departments = data?.departments ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Departments</h2>
          <p className="text-sm text-muted-foreground">
            Organize users and locations by department
          </p>
        </div>
        <Button onClick={openAdd} className="w-fit">
          <Plus className="h-4 w-4" /> Add Department
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : isError ? (
        <EmptyState
          icon={Building2}
          title="Failed to load departments"
          description={
            error instanceof Error ? error.message : "Please try again later."
          }
        />
      ) : departments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No departments yet"
          description="Create your first department to group users and locations."
          action={
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Department
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Description
                  </TableHead>
                  <TableHead className="text-center">Users</TableHead>
                  <TableHead className="text-center">Locations</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="pl-4 font-medium">{d.name}</TableCell>
                    <TableCell className="hidden max-w-xs truncate text-muted-foreground md:table-cell">
                      {d.description || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3 w-3" /> {d.userCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="gap-1">
                        <MapPin className="h-3 w-3" /> {d.locationCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${d.name}`}
                          onClick={() => openEdit(d)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${d.name}`}
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(d.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Add / Edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) setEditing(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Department" : "Add Department"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the department details below."
                : "Create a new department."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dept-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dept-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Maintenance"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-desc">Description</Label>
              <Textarea
                id="dept-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Short description of this department"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saveMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {editing ? "Save Changes" : "Create Department"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete department?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the department. Users and locations
              assigned to it may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (deleteId) deleteMutation.mutate(deleteId)
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
