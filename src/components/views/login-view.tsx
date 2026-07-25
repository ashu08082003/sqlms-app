"use client"

import { useState } from "react"
import { QrCode as QrCodeIcon, LogIn, ShieldCheck, ScanLine, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { apiFetch } from "@/lib/api-client"
import type { SafeUser } from "@/lib/types"
import { toast } from "sonner"

interface LoginViewProps {
  onLogin: (u: SafeUser) => void
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [email, setEmail] = useState("admin@plant.com")
  const [password, setPassword] = useState("admin123")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await apiFetch<{ user: SafeUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
      toast.success(`Welcome, ${res.user.name}`)
      onLogin(res.user)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  function quickLogin(em: string, pw: string) {
    setEmail(em)
    setPassword(pw)
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-teal-50 via-background to-background lg:flex-row">
      {/* Brand panel */}
      <div className="brand-gradient relative flex flex-col justify-between overflow-hidden p-8 text-white lg:w-1/2 lg:p-14">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 -left-10 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="rounded-xl bg-white/15 p-2 backdrop-blur">
            <QrCodeIcon className="h-7 w-7" />
          </div>
          <div>
            <p className="text-lg font-bold leading-tight">SQLMS</p>
            <p className="text-xs text-white/80">Smart QR Logbook Management</p>
          </div>
        </div>

        <div className="relative my-12 max-w-md">
          <h1 className="text-3xl font-bold leading-tight lg:text-4xl">
            One platform for every plant inspection.
          </h1>
          <p className="mt-4 text-white/85">
            Scan a QR code. Complete the checklist. Reports, emails and dashboards update
            automatically — for machines, washrooms, safety, electrical and more.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
              <ScanLine className="mb-1 h-5 w-5" />
              <p className="font-semibold">QR-driven</p>
              <p className="text-white/75">No searching, no typing</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
              <ShieldCheck className="mb-1 h-5 w-5" />
              <p className="font-semibold">Role-based</p>
              <p className="text-white/75">Admin & employee access</p>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-white/60">
          Digital Inspection & Maintenance System · Plant Operations Platform
        </p>
      </div>

      {/* Login form */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-14">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1">
            <h2 className="text-2xl font-bold">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access the logbook.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@plant.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" />
                )}
                Sign in
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Demo accounts
              </span>
              <Separator className="flex-1" />
            </div>

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => quickLogin("admin@plant.com", "admin123")}
                className="flex items-center justify-between rounded-lg border p-3 text-left text-sm transition hover:bg-accent"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>
                    <span className="font-medium">Admin</span>
                    <span className="ml-2 text-muted-foreground">admin@plant.com</span>
                  </span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">admin123</span>
              </button>
              <button
                type="button"
                onClick={() => quickLogin("emp.001@plant.com", "emp123")}
                className="flex items-center justify-between rounded-lg border p-3 text-left text-sm transition hover:bg-accent"
              >
                <span className="flex items-center gap-2">
                  <ScanLine className="h-4 w-4 text-primary" />
                  <span>
                    <span className="font-medium">Employee</span>
                    <span className="ml-2 text-muted-foreground">emp.001@plant.com</span>
                  </span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">emp123</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
