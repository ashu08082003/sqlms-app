"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, QrCode as QrCodeIcon } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { useAppStore } from "@/store/app-store"
import type { SafeUser } from "@/lib/types"
import { LoginView } from "@/components/views/login-view"
import { AppShell } from "@/components/app-shell"

function Gate() {
  const [loading, setLoading] = useState(true)
  const user = useAppStore((s) => s.user)
  const setUser = useAppStore((s) => s.setUser)
  const searchParams = useSearchParams()
  const [initialQr] = useState<string | null>(
    () => searchParams.get("qr")?.toUpperCase().trim() ?? null
  )

  useEffect(() => {
    apiFetch<{ user: SafeUser | null }>("/api/auth/me")
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [setUser])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="brand-gradient flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg">
          <QrCodeIcon className="h-7 w-7" />
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading SQLMS…
        </div>
      </div>
    )
  }

  if (!user) return <LoginView onLogin={setUser} />

  return <AppShell initialQr={initialQr} />
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <Gate />
    </Suspense>
  )
}
