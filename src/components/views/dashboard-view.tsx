"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  PieChart as PieChartIcon,
  TrendingUp,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/stat-card"
import { EmptyState } from "@/components/empty-state"
import { apiFetch } from "@/lib/api-client"
import { useAppStore } from "@/store/app-store"
import { cn } from "@/lib/utils"
import type { DashboardStats } from "@/lib/types"

interface DashboardResponse {
  stats: DashboardStats
}

const TEAL = "#0d9488"

function scoreTone(score: number): string {
  if (score === 100) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
  if (score >= 80) return "bg-amber-500/10 text-amber-700 dark:text-amber-400"
  return "bg-red-500/10 text-red-700 dark:text-red-400"
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: 12,
} as const

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-96" />
    </div>
  )
}

export function DashboardView() {
  const refreshKey = useAppStore((s) => s.refreshKey)
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", refreshKey],
    queryFn: () => apiFetch<DashboardResponse>("/api/dashboard"),
  })

  if (isLoading) return <DashboardSkeleton />

  if (isError || !data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load the dashboard"
        description="There was a problem fetching operations data. Please try again."
        className="mt-10"
      />
    )
  }

  const s = data.stats
  const totalCatCount = s.categoryBreakdown.reduce((a, b) => a + b.count, 0)
  const weekTotal = s.last7Days.reduce((a, b) => a + b.completed, 0)

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Operations Overview</h2>
          <p className="text-sm text-muted-foreground">{today}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          <span>Live · auto-refreshed</span>
        </div>
      </motion.div>

      {/* KPI cards */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="Total QR Locations"
          value={s.totalLocations}
          icon={MapPin}
          tone="primary"
          hint={`${s.totalInspections} inspections on record`}
        />
        <StatCard
          label="Today's Completed"
          value={s.completedToday}
          icon={CheckCircle2}
          tone="success"
          hint={`${s.completionRate}% of daily target`}
        />
        <StatCard
          label="Pending"
          value={s.pendingToday}
          icon={Clock}
          tone="warning"
          hint="Daily inspections due"
        />
        <StatCard
          label="Overdue"
          value={s.overdue}
          icon={AlertTriangle}
          tone="danger"
          hint="Missed &gt; 1 day"
        />
      </motion.div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card className="h-full">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="space-y-1">
                <CardTitle>Inspections — Last 7 Days</CardTitle>
                <CardDescription>Daily completed inspection counts</CardDescription>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-primary">{weekTotal}</p>
                <p className="text-xs text-muted-foreground">this week</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-x-auto">
                <div className="h-56 min-w-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={s.last7Days}
                      margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={TEAL} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="currentColor"
                        className="text-border"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        className="text-muted-foreground"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        allowDecimals={false}
                        className="text-muted-foreground"
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: "var(--muted-foreground)" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="completed"
                        name="Completed"
                        stroke={TEAL}
                        strokeWidth={2.5}
                        fill="url(#dashArea)"
                        dot={{ r: 3, fill: TEAL, strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Daily Completion Rate</span>
                  <span className="tabular-nums text-muted-foreground">
                    {s.completionRate}%
                  </span>
                </div>
                <Progress value={s.completionRate} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Inspections by Category</CardTitle>
              <CardDescription>Last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {s.categoryBreakdown.length === 0 || totalCatCount === 0 ? (
                <EmptyState
                  icon={PieChartIcon}
                  title="No category data"
                  description="No inspections recorded in the last 30 days."
                />
              ) : (
                <div className="space-y-4">
                  <div className="relative mx-auto h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={s.categoryBreakdown}
                          dataKey="count"
                          nameKey="category"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={2}
                          stroke="var(--card)"
                          strokeWidth={2}
                        >
                          {s.categoryBreakdown.map((c) => (
                            <Cell key={c.category} fill={c.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold tabular-nums">{totalCatCount}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        total
                      </span>
                    </div>
                  </div>
                  <ul className="max-h-40 space-y-1.5 overflow-y-auto scrollbar-thin pr-1">
                    {s.categoryBreakdown.map((c) => (
                      <li
                        key={c.category}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: c.color }}
                            aria-hidden
                          />
                          <span className="truncate">{c.category}</span>
                        </span>
                        <span className="ml-2 shrink-0 font-medium tabular-nums">
                          {c.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent activities */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Latest inspection submissions</CardDescription>
            </div>
            <ClipboardList className="h-5 w-5 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent>
            {s.recentActivities.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No recent activity"
                description="Inspection submissions will appear here."
              />
            ) : (
              <ul
                className="max-h-[28rem] divide-y divide-border overflow-y-auto scrollbar-thin"
                aria-label="Recent inspection activities"
              >
                {s.recentActivities.map((a) => {
                  const color =
                    s.categoryBreakdown.find((c) => c.category === a.categoryName)?.color ??
                    TEAL
                  return (
                    <li
                      key={a.id}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{a.locationName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {a.machineName} · {a.categoryName} · by {a.userName}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 pl-5 sm:pl-0">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {a.time}
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                            scoreTone(a.score)
                          )}
                          aria-label={`Score ${a.score} percent`}
                        >
                          {a.score}%
                        </span>
                        {a.failedCount > 0 && (
                          <span className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
                            {a.failedCount} failed
                          </span>
                        )}
                        <span className="hidden text-xs font-medium text-emerald-700 dark:text-emerald-400 sm:inline">
                          Completed
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
