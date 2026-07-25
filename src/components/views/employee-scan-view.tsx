"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  QrCode as QrCodeIcon,
  Camera,
  Keyboard,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  X,
  Upload,
  ScanLine,
  ClipboardCheck,
  Calendar,
  Clock,
  User as UserIcon,
  Building2,
  Tag,
  Hash,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { CategoryBadge } from "@/components/category-badge"
import { QrScanner } from "@/components/qr-scanner"
import { EmptyState } from "@/components/empty-state"
import {
  apiFetch,
  fileToDataUrl,
  formatDate,
  formatTime,
  formatDateTime,
} from "@/lib/api-client"
import { useAppStore } from "@/store/app-store"
import { STATUS_META, frequencyLabel } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { ItemStatus } from "@/lib/types"

/* ---------- Local API shape interfaces ---------- */
interface ResolvedLocation {
  id: string
  qrCode: string
  name: string
  machineName: string
  frequency: string
  categoryName: string
  categoryColor: string
  categoryIcon: string
  departmentName: string | null
}
interface ResolvedChecklist {
  id: string
  name: string
  description: string | null
  frequency: string
  items: string[]
}
interface ResolveResponse {
  location: ResolvedLocation
  checklist: ResolvedChecklist | null
}
interface SubmitInspectionResponse {
  inspection: {
    id: string
    inspectionDate: string
    passedCount: number
    failedCount: number
    naCount: number
    score: number
    location: { name: string; machineName: string; categoryName: string }
    user: { name: string }
  }
}
interface RecentInspection {
  id: string
  inspectionDate: string
  score: number
  passedCount: number
  failedCount: number
  naCount: number
  location: {
    id: string
    qrCode: string
    name: string
    machineName: string
    categoryName: string
    categoryColor: string
    departmentName: string | null
  }
  user: { id: string; name: string; employeeCode: string | null }
}

type Phase = "idle" | "resolving" | "form" | "submitting" | "success"
type ItemFormState = {
  status: ItemStatus | null
  reason: string
  photoUrl: string | null
}

const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024

/* ---------- Helpers ---------- */
function extractQr(raw: string): string | null {
  const m = raw.match(/QR\d+/i)
  return m ? m[0].toUpperCase() : null
}

function ScoreBadge({
  score,
  failed,
}: {
  score: number
  failed?: number
}) {
  const cls =
    score >= 95
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30"
      : score >= 80
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30"
        : "bg-red-500/15 text-red-700 dark:text-red-400 ring-1 ring-red-500/30"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        cls
      )}
    >
      {score.toFixed(1)}%
      {failed && failed > 0 ? ` · ${failed} fail` : ""}
    </span>
  )
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Hash
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-xs font-medium">{value}</p>
      </div>
    </div>
  )
}

function PhotoInput({
  label,
  photoUrl,
  onSelect,
  onClear,
}: {
  label: string
  photoUrl: string | null
  onSelect: (f: File | undefined) => void
  onClear: () => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {photoUrl ? (
        <div className="relative inline-block">
          <img
            src={photoUrl}
            alt="Uploaded inspection photo"
            className="h-24 w-24 rounded-md border object-cover"
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white shadow-md transition hover:bg-destructive/90"
            aria-label="Remove photo"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <label className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground transition hover:bg-accent">
          <Upload className="h-4 w-4" /> Upload photo
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onSelect(e.target.files?.[0] ?? undefined)}
          />
        </label>
      )}
    </div>
  )
}

function ItemCard({
  idx,
  label,
  state,
  onStatus,
  onReason,
  onPhotoSelect,
  onClearPhoto,
}: {
  idx: number
  label: string
  state: ItemFormState
  onStatus: (s: ItemStatus) => void
  onReason: (r: string) => void
  onPhotoSelect: (f: File | undefined) => void
  onClearPhoto: () => void
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition",
        state.status === "NOT_OK" &&
          "border-red-300 dark:border-red-500/40 bg-red-50/40 dark:bg-red-500/5"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
          {idx + 1}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2" role="group" aria-label={`Status for ${label}`}>
        {(["OK", "NOT_OK", "NA"] as ItemStatus[]).map((s) => {
          const meta = STATUS_META[s]
          const selected = state.status === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => onStatus(s)}
              aria-pressed={selected}
              aria-label={`${meta.label} for ${label}`}
              className={cn(
                "flex h-11 items-center justify-center rounded-md text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                selected
                  ? cn(meta.bg, "text-white ring-2", meta.ring)
                  : "border border-input bg-background hover:bg-accent"
              )}
            >
              {meta.label}
            </button>
          )
        })}
      </div>
      <AnimatePresence initial={false}>
        {state.status === "NOT_OK" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              <div className="space-y-1.5">
                <Label htmlFor={`reason-${idx}`} className="text-xs text-muted-foreground">
                  Reason (required)
                </Label>
                <Textarea
                  id={`reason-${idx}`}
                  value={state.reason}
                  onChange={(e) => onReason(e.target.value)}
                  placeholder="Describe the issue..."
                  className="min-h-20"
                />
              </div>
              <PhotoInput
                label="Photo (optional, encouraged)"
                photoUrl={state.photoUrl}
                onSelect={onPhotoSelect}
                onClear={onClearPhoto}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ---------- Main view ---------- */
export function EmployeeScanView({ initialQr }: { initialQr: string | null }) {
  const user = useAppStore((s) => s.user)
  const bump = useAppStore((s) => s.bump)

  const [phase, setPhase] = useState<Phase>(() =>
    initialQr && extractQr(initialQr) ? "resolving" : "idle"
  )
  const [qrInput, setQrInput] = useState("")
  const [scanning, setScanning] = useState(false)
  const [resolvedCode, setResolvedCode] = useState<string | null>(() =>
    initialQr ? extractQr(initialQr) : null
  )
  const [resolved, setResolved] = useState<ResolveResponse | null>(null)
  const [submitResult, setSubmitResult] = useState<SubmitInspectionResponse | null>(null)

  const [itemStates, setItemStates] = useState<ItemFormState[]>([])
  const [remarks, setRemarks] = useState("")
  const [overallPhoto, setOverallPhoto] = useState<string | null>(null)
  const [now, setNow] = useState<Date>(() => new Date())

  /* Recent inspections for the idle screen */
  const recentQuery = useQuery({
    queryKey: ["my-recent-inspections", user?.id],
    queryFn: () =>
      apiFetch<{ inspections: RecentInspection[] }>(
        `/api/inspections?userId=${user!.id}`
      ).then((r) => r.inspections.slice(0, 5)),
    enabled: !!user && phase === "idle",
  })

  /* Resolve effect — runs whenever we enter the resolving phase. */
  useEffect(() => {
    if (phase !== "resolving" || !resolvedCode) return
    let cancelled = false
    apiFetch<ResolveResponse>(`/api/locations/qr/${resolvedCode}`)
      .then((data) => {
        if (cancelled) return
        if (!data.checklist || data.checklist.items.length === 0) {
          toast.error("No checklist assigned to this location")
          setPhase("idle")
          setResolvedCode(null)
          return
        }
        setResolved(data)
        setItemStates(
          data.checklist.items.map(() => ({
            status: null,
            reason: "",
            photoUrl: null,
          }))
        )
        setRemarks("")
        setOverallPhoto(null)
        setNow(new Date())
        setPhase("form")
      })
      .catch((err) => {
        if (cancelled) return
        toast.error(
          err instanceof Error ? err.message : "QR code not found"
        )
        setPhase("idle")
        setResolvedCode(null)
      })
    return () => {
      cancelled = true
    }
  }, [phase, resolvedCode])

  function startResolve(code: string) {
    setResolvedCode(code)
    setScanning(false)
    setPhase("resolving")
  }

  function handleScanResult(decoded: string) {
    const code = extractQr(decoded)
    if (!code) {
      toast.error("Could not read QR code. Try again or enter it manually.")
      return
    }
    startResolve(code)
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = qrInput.trim().toUpperCase()
    if (!/^QR\d+$/.test(trimmed)) {
      toast.error("Enter a valid QR code (e.g. QR000124)")
      return
    }
    setQrInput("")
    startResolve(trimmed)
  }

  function resetAll() {
    setPhase("idle")
    setResolvedCode(null)
    setResolved(null)
    setSubmitResult(null)
    setItemStates([])
    setRemarks("")
    setOverallPhoto(null)
    setScanning(false)
  }

  const summary = useMemo(() => {
    let ok = 0
    let notOk = 0
    let na = 0
    for (const s of itemStates) {
      if (s.status === "OK") ok++
      else if (s.status === "NOT_OK") notOk++
      else if (s.status === "NA") na++
    }
    const denom = ok + notOk
    const score = denom === 0 ? 100 : Math.round((ok / denom) * 1000) / 10
    return { ok, notOk, na, score }
  }, [itemStates])

  const canSubmit = useMemo(() => {
    if (itemStates.length === 0) return false
    for (const s of itemStates) {
      if (!s.status) return false
      if (s.status === "NOT_OK" && !s.reason.trim()) return false
    }
    return true
  }, [itemStates])

  const isDirty = useMemo(() => {
    if (remarks.trim()) return true
    if (overallPhoto) return true
    return itemStates.some(
      (s) =>
        s.status !== null || s.reason.trim() !== "" || s.photoUrl !== null
    )
  }, [itemStates, remarks, overallPhoto])

  function setItemStatus(idx: number, status: ItemStatus) {
    setItemStates((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, status: s.status === status ? null : status } : s
      )
    )
  }
  function setItemReason(idx: number, reason: string) {
    setItemStates((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, reason } : s))
    )
  }
  function setItemPhoto(idx: number, photoUrl: string | null) {
    setItemStates((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, photoUrl } : s))
    )
  }

  async function handlePhotoSelect(
    file: File | undefined,
    onSet: (url: string | null) => void
  ) {
    if (!file) return
    if (file.size > MAX_PHOTO_BYTES) {
      toast.warning("Image is too large (max 1.5 MB)")
      return
    }
    try {
      const url = await fileToDataUrl(file)
      onSet(url)
    } catch {
      toast.error("Could not read image file")
    }
  }

  function handleCancel() {
    if (
      isDirty &&
      !window.confirm("Discard this inspection? Your entries will be lost.")
    )
      return
    resetAll()
  }

  async function handleSubmit() {
    if (!resolved || !resolved.checklist) return
    if (!canSubmit) {
      for (let i = 0; i < itemStates.length; i++) {
        const s = itemStates[i]
        if (!s.status) {
          toast.error(
            `Please set a status for item ${i + 1}: "${resolved.checklist.items[i]}"`
          )
          return
        }
        if (s.status === "NOT_OK" && !s.reason.trim()) {
          toast.error(
            `Please provide a reason for "${resolved.checklist.items[i]}" (marked Not OK)`
          )
          return
        }
      }
      return
    }
    setPhase("submitting")
    try {
      const responses = itemStates.map((s, i) => ({
        item: resolved.checklist!.items[i],
        status: s.status!,
        reason: s.status === "NOT_OK" ? s.reason.trim() : undefined,
        photoUrl: s.photoUrl ?? undefined,
      }))
      const result = await apiFetch<SubmitInspectionResponse>(
        "/api/inspections",
        {
          method: "POST",
          body: JSON.stringify({
            locationId: resolved.location.id,
            responses,
            remarks: remarks.trim() || undefined,
            photoUrl: overallPhoto ?? undefined,
          }),
        }
      )
      setSubmitResult(result)
      bump()
      setPhase("success")
      toast.success("Inspection submitted")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to submit inspection"
      )
      setPhase("form")
    }
  }

  /* ---------- Render ---------- */
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={phase}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18 }}
      >
        {/* ===== IDLE ===== */}
        {phase === "idle" && (
          <div className="space-y-6">
            <Card className="overflow-hidden border-0 p-0">
              <div className="brand-gradient relative p-6 text-white sm:p-8">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                <div className="relative flex items-center gap-3">
                  <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur">
                    <QrCodeIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold sm:text-2xl">
                      Scan to Inspect
                    </h2>
                    <p className="text-sm text-white/85">
                      Point your camera at the location QR code or enter it manually.
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="space-y-4 p-4 sm:p-6">
                <Button
                  onClick={() => setScanning((v) => !v)}
                  className="h-12 w-full text-base"
                  variant={scanning ? "outline" : "default"}
                >
                  {scanning ? (
                    <>
                      <X className="mr-2 h-5 w-5" /> Stop camera
                    </>
                  ) : (
                    <>
                      <Camera className="mr-2 h-5 w-5" /> Scan with camera
                    </>
                  )}
                </Button>

                {scanning && (
                  <QrScanner
                    onScan={handleScanResult}
                    onClose={() => setScanning(false)}
                  />
                )}

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="h-px w-full bg-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-3 text-xs uppercase tracking-wide text-muted-foreground">
                      or enter manually
                    </span>
                  </div>
                </div>

                <form
                  onSubmit={handleManualSubmit}
                  className="flex flex-col gap-2 sm:flex-row"
                >
                  <Input
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    placeholder="QR000124"
                    className="h-12 text-base font-mono uppercase"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    aria-label="QR code"
                  />
                  <Button
                    type="submit"
                    className="h-12 sm:w-auto"
                    disabled={!qrInput.trim()}
                  >
                    <Keyboard className="mr-2 h-4 w-4" /> Continue
                  </Button>
                </form>

                {user && (
                  <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <UserIcon className="h-3.5 w-3.5" /> Signed in as{" "}
                    <span className="font-medium text-foreground">
                      {user.name}
                    </span>
                    {user.role === "ADMIN" && (
                      <span className="ml-1 inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <ShieldCheck className="h-3 w-3" /> Admin
                      </span>
                    )}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="h-4 w-4 text-primary" /> My recent
                  inspections
                </CardTitle>
                <CardDescription>
                  Your last 5 completed inspections across all locations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentQuery.isLoading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : recentQuery.data && recentQuery.data.length > 0 ? (
                  <ul className="max-h-64 space-y-2 overflow-y-auto scrollbar-thin">
                    {recentQuery.data.map((insp) => (
                      <li
                        key={insp.id}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {insp.location.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {insp.location.machineName} ·{" "}
                            {formatDateTime(insp.inspectionDate)}
                          </p>
                        </div>
                        <ScoreBadge
                          score={insp.score}
                          failed={insp.failedCount}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={ClipboardCheck}
                    title="No inspections yet"
                    description="Your completed inspections will appear here."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== RESOLVING ===== */}
        {phase === "resolving" && (
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium">Resolving {resolvedCode}…</p>
                <p className="text-xs text-muted-foreground">
                  Fetching checklist for this location
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== FORM / SUBMITTING ===== */}
        {(phase === "form" || phase === "submitting") && resolved && (
          <div className="space-y-4">
            {/* Location header card */}
            <Card>
              <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <CategoryBadge
                    icon={resolved.location.categoryIcon}
                    color={resolved.location.categoryColor}
                    name={resolved.location.categoryName}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    disabled={phase === "submitting"}
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" /> Cancel
                  </Button>
                </div>
                <div>
                  <h2 className="text-xl font-bold sm:text-2xl">
                    {resolved.location.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {resolved.location.machineName}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Meta
                    icon={Hash}
                    label="QR"
                    value={resolved.location.qrCode}
                  />
                  <Meta
                    icon={Building2}
                    label="Dept"
                    value={resolved.location.departmentName ?? "—"}
                  />
                  <Meta
                    icon={Calendar}
                    label="Frequency"
                    value={frequencyLabel(resolved.location.frequency)}
                  />
                  <Meta
                    icon={Tag}
                    label="Checklist"
                    value={resolved.checklist?.name ?? "—"}
                  />
                </div>
                <Separator />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Meta icon={Calendar} label="Date (auto)" value={formatDate(now)} />
                  <Meta icon={Clock} label="Time (auto)" value={formatTime(now)} />
                  <Meta
                    icon={UserIcon}
                    label="User (auto)"
                    value={user?.name ?? "—"}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Checklist items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inspection checklist</CardTitle>
                {resolved.checklist?.description && (
                  <CardDescription>
                    {resolved.checklist.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {resolved.checklist!.items.map((item, idx) => (
                  <ItemCard
                    key={`${item}-${idx}`}
                    idx={idx}
                    label={item}
                    state={itemStates[idx] ?? { status: null, reason: "", photoUrl: null }}
                    onStatus={(s) => setItemStatus(idx, s)}
                    onReason={(r) => setItemReason(idx, r)}
                    onPhotoSelect={(f) =>
                      handlePhotoSelect(f, (url) => setItemPhoto(idx, url))
                    }
                    onClearPhoto={() => setItemPhoto(idx, null)}
                  />
                ))}

                <Separator />

                {/* Overall remarks */}
                <div className="space-y-1.5">
                  <Label htmlFor="remarks">Remarks (optional)</Label>
                  <Textarea
                    id="remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Add any general notes about this inspection..."
                  />
                </div>

                <PhotoInput
                  label="Overall photo (optional)"
                  photoUrl={overallPhoto}
                  onSelect={(f) => handlePhotoSelect(f, setOverallPhoto)}
                  onClear={() => setOverallPhoto(null)}
                />

                {/* Live summary */}
                <div className="rounded-lg border bg-muted/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {summary.ok} OK
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-semibold text-red-700 dark:text-red-400">
                        {summary.notOk} Not OK
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-semibold text-zinc-600 dark:text-zinc-400">
                        {summary.na} N/A
                      </span>
                    </div>
                    <span className="font-semibold">
                      Score: {summary.score.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sticky bottom action bar */}
            <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-12 flex-1"
                  onClick={handleCancel}
                  disabled={phase === "submitting"}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
                </Button>
                <Button
                  className="h-12 flex-1"
                  onClick={handleSubmit}
                  disabled={!canSubmit || phase === "submitting"}
                >
                  {phase === "submitting" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                      Submitting…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Submit Inspection
                    </>
                  )}
                </Button>
              </div>
              {!canSubmit && phase === "form" && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" />
                  Set a status for every item
                  {itemStates.some((s) => s.status === "NOT_OK")
                    ? " and provide reasons for any Not OK items"
                    : ""}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ===== SUCCESS ===== */}
        {phase === "success" && submitResult && (
          <Card className="overflow-hidden border-0 p-0">
            <div className="bg-emerald-500 p-6 text-white sm:p-8">
              <div className="flex flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18 }}
                  className="rounded-full bg-white/20 p-3 backdrop-blur"
                >
                  <CheckCircle2 className="h-12 w-12" />
                </motion.div>
                <h2 className="mt-3 text-2xl font-bold">
                  Inspection Submitted
                </h2>
                <p className="text-sm text-white/85">
                  Report saved · Dashboard updated
                </p>
              </div>
            </div>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="rounded-lg border p-3">
                <p className="font-semibold">
                  {submitResult.inspection.location.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {submitResult.inspection.location.machineName} ·{" "}
                  {submitResult.inspection.location.categoryName}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border bg-emerald-500/5 p-3">
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {submitResult.inspection.passedCount}
                  </p>
                  <p className="text-xs text-muted-foreground">OK</p>
                </div>
                <div className="rounded-lg border bg-red-500/5 p-3">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {submitResult.inspection.failedCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Not OK</p>
                </div>
                <div className="rounded-lg border bg-zinc-500/5 p-3">
                  <p className="text-2xl font-bold text-zinc-600 dark:text-zinc-400">
                    {submitResult.inspection.naCount}
                  </p>
                  <p className="text-xs text-muted-foreground">N/A</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                <span className="text-sm font-medium">Score</span>
                <ScoreBadge
                  score={submitResult.inspection.score}
                  failed={submitResult.inspection.failedCount}
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Completed by {submitResult.inspection.user.name} ·{" "}
                {formatDateTime(submitResult.inspection.inspectionDate)}
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="h-12 flex-1"
                  onClick={resetAll}
                >
                  <ScanLine className="mr-2 h-4 w-4" /> Scan Another
                </Button>
                <Button className="h-12 flex-1" onClick={resetAll}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Done
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
