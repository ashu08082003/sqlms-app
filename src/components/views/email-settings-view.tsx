"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Mail,
  Save,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Inbox,
  Eye,
  ShieldAlert,
  Settings2,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiFetch, formatDateTime } from "@/lib/api-client"
import { useAppStore } from "@/store/app-store"
import { EmptyState } from "@/components/empty-state"
import { cn } from "@/lib/utils"

interface EmailConfig {
  reportToEmail: string
  escalationToEmail: string
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  fromEmail: string
  fromName: string
  enableReportEmail: boolean
  enableEscalation: boolean
  simulateOnly: boolean
  hasSmtpPass: boolean
}
interface EmailLogRow {
  id: string
  to: string
  subject: string
  status: "SENT" | "FAILED" | "SIMULATED"
  type: "REPORT" | "ESCALATION"
  error: string | null
  createdAt: string
  inspection: {
    id: string
    locationName: string
    machineName: string
    userName: string
  } | null
}
interface EmailDetail extends EmailLogRow {
  bodyHtml: string
}

const STATUS_META = {
  SENT: { label: "Sent", icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  SIMULATED: { label: "Simulated", icon: Clock, cls: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  FAILED: { label: "Failed", icon: XCircle, cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
} as const

export function EmailSettingsView() {
  const refreshKey = useAppStore((s) => s.refreshKey)
  const bump = useAppStore((s) => s.bump)
  const queryClient = useQueryClient()

  const { data: cfgData, isLoading: cfgLoading } = useQuery({
    queryKey: ["email-config", refreshKey],
    queryFn: () => apiFetch<{ config: EmailConfig }>("/api/settings/email"),
  })
  const config = cfgData?.config

  const [form, setForm] = useState<EmailConfig | null>(null)
  const [testEmail, setTestEmail] = useState("")
  const [logFilter, setLogFilter] = useState<string>("ALL")
  const [viewing, setViewing] = useState<EmailDetail | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  // Sync form when config loads
  if (config && !form) setForm(config)

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("No form data")
      return apiFetch("/api/settings/email", {
        method: "PUT",
        body: JSON.stringify(form),
      })
    },
    onSuccess: (res: { config: EmailConfig }) => {
      setForm(res.config)
      bump()
      toast.success("Email settings saved")
    },
    onError: (e: Error) => toast.error(e.message || "Failed to save settings"),
  })

  const testMutation = useMutation({
    mutationFn: (to: string) =>
      apiFetch<{ status: string; error?: string }>("/api/settings/email", {
        method: "POST",
        body: JSON.stringify({ to }),
      }),
    onSuccess: (res) => {
      if (res.status === "SENT") toast.success("Test email sent successfully")
      else if (res.status === "SIMULATED") toast.info("Test email simulated (logged but not sent — Simulate mode is ON)")
      else toast.error(res.error || "Test email failed")
      bump()
    },
    onError: (e: Error) => toast.error(e.message || "Failed to send test email"),
  })

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["email-logs", refreshKey, logFilter],
    queryFn: () => {
      const qs = logFilter === "ALL" ? "" : `?type=${logFilter}`
      return apiFetch<{ emails: EmailLogRow[] }>(`/api/emails${qs}`)
    },
  })
  const logs = logsData?.emails ?? []

  async function openEmail(id: string) {
    setViewLoading(true)
    setViewing(null)
    try {
      const res = await apiFetch<{ email: EmailDetail }>(`/api/emails/${id}`)
      setViewing(res.email)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load email")
    } finally {
      setViewLoading(false)
    }
  }

  function update<K extends keyof EmailConfig>(key: K, value: EmailConfig[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Email & Alerts</h2>
        <p className="text-sm text-muted-foreground">
          Configure email recipients and SMTP once. Reports and escalations are sent automatically on every inspection submission.
        </p>
      </div>

      {cfgLoading || !form ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recipients & rules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-4 w-4 text-primary" /> Recipients & Rules
              </CardTitle>
              <CardDescription>Where reports and escalations are sent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="report-to" className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Report email (completed inspections)
                </Label>
                <Input
                  id="report-to"
                  type="email"
                  value={form.reportToEmail}
                  onChange={(e) => update("reportToEmail", e.target.value)}
                  placeholder="reports@plant.com"
                />
                <p className="text-xs text-muted-foreground">
                  Every completed inspection sends a full report here.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="esc-to" className="flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-red-500" /> Escalation email (failures)
                </Label>
                <Input
                  id="esc-to"
                  type="email"
                  value={form.escalationToEmail}
                  onChange={(e) => update("escalationToEmail", e.target.value)}
                  placeholder="maintenance@plant.com"
                />
                <p className="text-xs text-muted-foreground">
                  When any item is marked <strong>Not OK</strong>, an escalation with the failed items is sent here.
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="rep-toggle" className="cursor-pointer font-medium">
                    Auto-send report emails
                  </Label>
                  <p className="text-xs text-muted-foreground">Send a report email on every completed inspection.</p>
                </div>
                <Switch
                  id="rep-toggle"
                  checked={form.enableReportEmail}
                  onCheckedChange={(v) => update("enableReportEmail", v)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="esc-toggle" className="cursor-pointer font-medium">
                    Auto-escalate failures
                  </Label>
                  <p className="text-xs text-muted-foreground">Escalate to the escalation email when items fail.</p>
                </div>
                <Switch
                  id="esc-toggle"
                  checked={form.enableEscalation}
                  onCheckedChange={(v) => update("enableEscalation", v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* SMTP */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Send className="h-4 w-4 text-primary" /> SMTP Configuration
              </CardTitle>
              <CardDescription>Outgoing mail server settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="from-name">From name</Label>
                  <Input
                    id="from-name"
                    value={form.fromName}
                    onChange={(e) => update("fromName", e.target.value)}
                    placeholder="SQLMS Logbook"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="from-email">From email</Label>
                  <Input
                    id="from-email"
                    type="email"
                    value={form.fromEmail}
                    onChange={(e) => update("fromEmail", e.target.value)}
                    placeholder="logbook@plant.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-host">SMTP host</Label>
                  <Input
                    id="smtp-host"
                    value={form.smtpHost}
                    onChange={(e) => update("smtpHost", e.target.value)}
                    placeholder="smtp.office365.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-port">SMTP port</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    value={form.smtpPort}
                    onChange={(e) => update("smtpPort", parseInt(e.target.value || "587", 10))}
                    placeholder="587"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-user">SMTP username</Label>
                  <Input
                    id="smtp-user"
                    value={form.smtpUser}
                    onChange={(e) => update("smtpUser", e.target.value)}
                    placeholder="logbook@plant.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-pass">
                    SMTP password{" "}
                    {form.hasSmtpPass && (
                      <span className="text-xs text-emerald-600">(saved)</span>
                    )}
                  </Label>
                  <Input
                    id="smtp-pass"
                    type="password"
                    value={form.smtpPass}
                    onChange={(e) => update("smtpPass", e.target.value)}
                    placeholder={form.hasSmtpPass ? "•••••••• (leave blank to keep)" : "Enter password"}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="sim-toggle" className="cursor-pointer font-medium">
                    Simulate mode
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When ON, emails are logged (with full content) but not actually sent. Turn OFF to send real emails via SMTP.
                  </p>
                </div>
                <Switch
                  id="sim-toggle"
                  checked={form.simulateOnly}
                  onCheckedChange={(v) => update("simulateOnly", v)}
                />
              </div>

              {form.simulateOnly && (
                <div className="flex items-start gap-2 rounded-lg bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-300">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>Simulate mode is ON.</strong> Emails will be generated and logged so you can preview them, but no real emails are sent. Turn this OFF after entering valid SMTP credentials.
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Test email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-primary" /> Send Test Email
          </CardTitle>
          <CardDescription>Verify your configuration by sending a test email.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="sm:max-w-xs"
            />
            <Button
              onClick={() => testMutation.mutate(testEmail)}
              disabled={testMutation.isPending || !testEmail}
              variant="outline"
            >
              {testMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email log */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Inbox className="h-4 w-4 text-primary" /> Email Log
              </CardTitle>
              <CardDescription>All auto-generated reports and escalations.</CardDescription>
            </div>
            <Select value={logFilter} onValueChange={setLogFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All emails</SelectItem>
                <SelectItem value="REPORT">Reports only</SelectItem>
                <SelectItem value="ESCALATION">Escalations only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {logsLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No emails yet"
              description="Submit an inspection or send a test email — auto-generated reports and escalations will appear here."
              className="mx-4 mb-4"
            />
          ) : (
            <div className="max-h-[28rem] overflow-auto scrollbar-thin">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="hidden md:table-cell">To</TableHead>
                    <TableHead className="hidden lg:table-cell">Inspection</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">When</TableHead>
                    <TableHead className="text-right">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((e) => {
                    const meta = STATUS_META[e.status]
                    const StatusIcon = meta.icon
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          {e.type === "ESCALATION" ? (
                            <Badge variant="outline" className="gap-1 border-red-300 text-red-600">
                              <AlertTriangle className="h-3 w-3" /> Escalation
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <Mail className="h-3 w-3" /> Report
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[16rem] truncate font-medium">
                          {e.subject}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {e.to}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {e.inspection
                            ? `${e.inspection.locationName} · ${e.inspection.machineName}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
                              meta.cls
                            )}
                          >
                            <StatusIcon className="h-3 w-3" /> {meta.label}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                          {formatDateTime(e.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEmail(e.id)}
                            aria-label="View email"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email preview dialog */}
      <Dialog open={!!viewing || viewLoading} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="text-base">
              {viewing?.subject ?? "Loading email…"}
            </DialogTitle>
            {viewing && (
              <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                  <strong>To:</strong> {viewing.to}
                </span>
                <span className="flex items-center gap-1">
                  <strong>Status:</strong>
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", STATUS_META[viewing.status].cls)}>
                    {STATUS_META[viewing.status].label}
                  </span>
                </span>
                <span>
                  <strong>When:</strong> {formatDateTime(viewing.createdAt)}
                </span>
              </DialogDescription>
            )}
            {viewing?.error && (
              <div className="mt-2 flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{viewing.error}</span>
              </div>
            )}
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto bg-muted/30 scrollbar-thin">
            {viewLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : viewing ? (
              <div
                className="bg-white"
                // The email HTML is generated server-side from trusted inspection data (no user input).
                // It is a self-contained styled email template, safe to render in a sandboxed container.
                dangerouslySetInnerHTML={{ __html: viewing.bodyHtml }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
