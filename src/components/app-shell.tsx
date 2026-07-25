"use client"

import { useEffect, useState } from "react"
import {
  QrCode as QrCodeIcon,
  LayoutDashboard,
  MapPin,
  ListChecks,
  Tags,
  Users,
  ClipboardList,
  BarChart3,
  LogOut,
  Sun,
  Moon,
  Menu,
  ShieldCheck,
  ScanLine,
  ChevronDown,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { apiFetch, clearToken } from "@/lib/api-client"
import { useAppStore, type AdminSection } from "@/store/app-store"
import { DashboardView } from "@/components/views/dashboard-view"
import { LocationsView } from "@/components/views/locations-view"
import { ChecklistsView } from "@/components/views/checklists-view"
import { CategoriesView } from "@/components/views/categories-view"
import { UsersView } from "@/components/views/users-view"
import { InspectionsView } from "@/components/views/inspections-view"
import { AnalyticsView } from "@/components/views/analytics-view"
import { EmployeeScanView } from "@/components/views/employee-scan-view"
import { toast } from "sonner"

const NAV: { section: AdminSection; label: string; icon: typeof LayoutDashboard }[] = [
  { section: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { section: "locations", label: "QR Locations", icon: MapPin },
  { section: "checklists", label: "Checklists", icon: ListChecks },
  { section: "categories", label: "Categories & Depts", icon: Tags },
  { section: "users", label: "Users", icon: Users },
  { section: "inspections", label: "Reports", icon: ClipboardList },
  { section: "analytics", label: "Analytics", icon: BarChart3 },
]

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])
  if (!mounted) return <div className="h-9 w-9" />
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const section = useAppStore((s) => s.section)
  const setSection = useAppStore((s) => s.setSection)
  return (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const Icon = item.icon
        const active = section === item.section
        return (
          <button
            key={item.section}
            onClick={() => {
              setSection(item.section)
              onNavigate?.()
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
        <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-lg text-white">
          <QrCodeIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">SQLMS</p>
          <p className="text-[11px] text-sidebar-foreground/60">Smart QR Logbook</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        <NavList onNavigate={onNavigate} />
      </div>
      <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-sidebar-foreground/50">
        Digital Inspection & Maintenance System
      </div>
    </div>
  )
}

function UserMenu() {
  const user = useAppStore((s) => s.user)!
  const setUser = useAppStore((s) => s.setUser)

  async function logout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" })
    } catch {
      /* ignore */
    }
    clearToken()
    setUser(null)
    toast.success("Signed out")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg border bg-background px-2 py-1.5 text-sm transition hover:bg-accent">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left sm:block">
            <p className="text-xs font-medium leading-tight">{user.name}</p>
            <p className="text-[10px] text-muted-foreground">{user.role}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="font-medium">{user.name}</p>
          <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
          {user.departmentName && (
            <Badge variant="secondary" className="mt-1 text-[10px]">
              {user.departmentName}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppShell({ initialQr }: { initialQr: string | null }) {
  const user = useAppStore((s) => s.user)!
  const section = useAppStore((s) => s.section)
  const [mobileOpen, setMobileOpen] = useState(false)

  const isAdmin = user.role === "ADMIN"
  const currentLabel = NAV.find((n) => n.section === section)?.label ?? "Dashboard"

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur no-print">
        {!isAdmin && (
          <div className="flex items-center gap-2">
            <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-white">
              <QrCodeIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">SQLMS</p>
              <p className="text-[10px] text-muted-foreground">Inspector</p>
            </div>
          </div>
        )}

        {isAdmin && (
          <>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="hidden lg:block">
              <h1 className="text-base font-semibold">{currentLabel}</h1>
            </div>
            <div className="lg:hidden">
              <h1 className="text-base font-semibold">{currentLabel}</h1>
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {!isAdmin && (
            <Badge variant="outline" className="hidden gap-1 sm:flex">
              <ScanLine className="h-3 w-3" /> Inspector
            </Badge>
          )}
          {isAdmin && (
            <Badge variant="outline" className="hidden gap-1 sm:flex">
              <ShieldCheck className="h-3 w-3" /> Administrator
            </Badge>
          )}
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <div className="flex flex-1">
        {isAdmin && (
          <aside className="hidden w-64 shrink-0 lg:block no-print">
            <div className="sticky top-14 h-[calc(100vh-3.5rem)]">
              <Sidebar />
            </div>
          </aside>
        )}

        <main className="flex-1 overflow-x-hidden">
          {isAdmin ? (
            <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
              {section === "dashboard" && <DashboardView />}
              {section === "locations" && <LocationsView />}
              {section === "checklists" && <ChecklistsView />}
              {section === "categories" && <CategoriesView />}
              {section === "users" && <UsersView />}
              {section === "inspections" && <InspectionsView />}
              {section === "analytics" && <AnalyticsView />}
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
              <EmployeeScanView initialQr={initialQr} />
            </div>
          )}
        </main>
      </div>

      <footer className="mt-auto border-t bg-background px-4 py-3 text-center text-xs text-muted-foreground no-print">
        <p>
          SQLMS · Smart QR Logbook Management System · Plant Operations Platform
        </p>
      </footer>
    </div>
  )
}
