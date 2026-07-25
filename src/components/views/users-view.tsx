"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  ScanLine,
  Loader2,
  Users as UsersIcon,
  Mail,
  Phone,
  Hash,
  Building2,
  ClipboardCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { apiFetch } from "@/lib/api-client"
import { useAppStore } from "@/store/app-store"
import { formatDate } from "@/lib/api-client"
import { EmptyState } from "@/components/empty-state"
import { cn } from "@/lib/utils"

interface UserRow {
  id: string
  email: string
  name: string
  role: "ADMIN" | "EMPLOYEE"
  employeeCode: string | null
  phone: string | null
  departmentId: string | null
  departmentName: string | null
  active: boolean
  inspectionCount: number
  createdAt: string
}
interface DeptRow {
  id: string
  name: string
  description: string | null
  userCount: number
  locationCount: number
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

interface FormState {
  name: string
  email: string
  password: string
  role: "ADMIN" | "EMPLOYEE"
  employeeCode: string
  phone: string
  departmentId: string
  active: boolean
}

const EMPTY: FormState = {
  name: "",
  email: "",
  password: "",
  role: "EMPLOYEE",
  employeeCode: "",
  phone: "",
  departmentId: "",
  active: true,
}

export function UsersView() {
  const refreshKey = useAppStore((s) => s.refreshKey)
  const bump = useAppStore((s) => s.bump)
  const currentUser = useAppStore((s) => s.user)!

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["users", refreshKey],
    queryFn: () => apiFetch<{ users: UserRow[] }>("/api/users"),
  })
  const { data: deptsData } = useQuery({
    queryKey: ["departments", refreshKey],
    queryFn: () => apiFetch<{ departments: DeptRow[] }>("/api/departments"),
  })

  const users = usersData?.users ?? []
  const departments = deptsData?.departments ?? []

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setDialogOpen(true)
  }
  function openEdit(u: UserRow) {
    setEditing(u)
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      employeeCode: u.employeeCode ?? "",
      phone: u.phone ?? "",
      departmentId: u.departmentId ?? "",
      active: u.active,
    })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        employeeCode: form.employeeCode || undefined,
        phone: form.phone || undefined,
        departmentId: form.departmentId || undefined,
        active: form.active,
      }
      if (form.password) payload.password = form.password
      if (editing) {
        return apiFetch(`/api/users/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })
      }
      if (!form.password) throw new Error("Password is required for new users")
      payload.password = form.password
      return apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      toast.success(editing ? "User updated" : "User created")
      bump()
      setDialogOpen(false)
    },
    onError: (e: Error) => toast.error(e.message || "Failed to save user"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("User deleted")
      bump()
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete user"),
  })

  const adminCount = users.filter((u) => u.role === "ADMIN").length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Users</h2>
          <p className="text-sm text-muted-foreground">
            Manage admin & employee accounts and their access.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <UsersIcon className="h-4 w-4" />
              <span className="text-xs font-medium">Total</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-medium">Admins</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{adminCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ScanLine className="h-4 w-4" />
              <span className="text-xs font-medium">Employees</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{users.length - adminCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span className="text-xs font-medium">Departments</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{departments.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title="No users yet"
              description="Add your first admin or employee to get started."
              action={
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" /> Add User
                </Button>
              }
              className="mx-4 mb-4"
            />
          ) : (
            <div className="max-h-[32rem] overflow-auto scrollbar-thin">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="hidden md:table-cell">Role</TableHead>
                    <TableHead className="hidden lg:table-cell">Department</TableHead>
                    <TableHead className="hidden sm:table-cell">Inspections</TableHead>
                    <TableHead className="hidden xl:table-cell">Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback
                              className={cn(
                                "text-xs",
                                u.role === "ADMIN"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {initials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{u.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {u.role === "ADMIN" ? (
                          <Badge className="gap-1 bg-primary text-primary-foreground">
                            <ShieldCheck className="h-3 w-3" /> Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <ScanLine className="h-3 w-3" /> Employee
                          </Badge>
                        )}
                        {!u.active && (
                          <Badge variant="outline" className="ml-1 text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {u.departmentName ?? "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="gap-1">
                          <ClipboardCheck className="h-3 w-3" /> {u.inspectionCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(u)}
                            aria-label={`Edit ${u.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(u)}
                            disabled={u.id === currentUser.id}
                            aria-label={`Delete ${u.name}`}
                            className="text-destructive hover:text-destructive"
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
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Add User"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update account details. Leave password blank to keep unchanged."
                : "Create a new admin or employee account."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="u-name">Full name</Label>
                <Input
                  id="u-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ashutosh Kumar"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-email" className="flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </Label>
                <Input
                  id="u-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@plant.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-code" className="flex items-center gap-1">
                  <Hash className="h-3 w-3" /> Employee code
                </Label>
                <Input
                  id="u-code"
                  value={form.employeeCode}
                  onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                  placeholder="EMP-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-pass">
                  Password {editing && <span className="text-xs text-muted-foreground">(unchanged)</span>}
                </Label>
                <Input
                  id="u-pass"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editing ? "••••••••" : "Set a password"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-phone" className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Phone
                </Label>
                <Input
                  id="u-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v as "ADMIN" | "EMPLOYEE" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">Employee (scan only)</SelectItem>
                    <SelectItem value="ADMIN">Admin (full access)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select
                  value={form.departmentId || "__none__"}
                  onValueChange={(v) =>
                    setForm({ ...form, departmentId: v === "__none__" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— No department —</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="u-active" className="cursor-pointer">
                    Active account
                  </Label>
                  <p className="text-xs text-muted-foreground">Inactive users cannot sign in.</p>
                </div>
                <Switch
                  id="u-active"
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.name || !form.email}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and remove their
              inspection history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
