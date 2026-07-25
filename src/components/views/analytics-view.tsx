"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  Award,
  BarChart3,
  Building2,
  Clock,
  Gauge,
  ListChecks,
  Users,
  Wrench,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatCard } from "@/components/stat-card"
import { EmptyState } from "@/components/empty-state"
import { apiFetch } from "@/lib/api-client"
import { useAppStore } from "@/store/app-store"
import { frequencyLabel } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface AnalyticsData {
  mostFailedMachines: { name: string; failures: number }[]
  topPending: {
    name: string
    machineName: string
    frequency: string
    lastDays: number
  }[]
  avgCompletionTime: string
  averageScore: number
  topEmployees: { name: string; count: number }[]
  monthlyCompletion: { month: string; rate: number }[]
  departmentPerformance: {
    department: string
    inspections: number
    avgScore: number
  }[]
  categoryPerformance: {
    category: string
    inspections: number
    avgScore: number
    color: string
  }[]
}

interface AnalyticsResponse {
  analytics: AnalyticsData
}

const TEAL = "#0d9488"

function scoreTone(score: number): string {
  if (score >= 95) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
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

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    </div>
  )
}

export function AnalyticsView() {
  const refreshKey = useAppStore((s) => s.refreshKey)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics", refreshKey],
    queryFn: () => apiFetch<AnalyticsResponse>("/api/analytics"),
  })

  if (isLoading) return <AnalyticsSkeleton />

  if (isError || !data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load analytics"
        description="There was a problem fetching analytics. Please try again."
        className="mt-10"
      />
    )
  }

  const a = data.analytics
  const maxFailures = a.mostFailedMachines[0]?.failures ?? 0
  const maxEmployeeCount = a.topEmployees[0]?.count ?? 0
  const topEmployee = a.topEmployees[0]

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics &amp; Insights</h2>
          <p className="text-sm text-muted-foreground">Last 30 days performance</p>
        </div>
      </motion.div>

      {/* KPI row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="Avg Inspection Score"
          value={`${a.averageScore}%`}
          icon={Gauge}
          tone="primary"
          hint="Across all inspections"
        />
        <StatCard
          label="Avg Completion Time"
          value={a.avgCompletionTime}
          icon={Clock}
          tone="default"
          hint="Time of day"
        />
        <StatCard
          label="Categories Tracked"
          value={a.categoryPerformance.length}
          icon={ListChecks}
          tone="default"
          hint="With recorded activity"
        />
        <StatCard
          label="Most Active Employee"
          value={topEmployee?.name ?? "—"}
          icon={Award}
          tone="success"
          hint={topEmployee ? `${topEmployee.count} inspections` : undefined}
        />
      </motion.div>

      {/* Charts grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Monthly completion */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Monthly Completion Rate</CardTitle>
              <CardDescription>
                Last 6 months · % of daily locations inspected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-x-auto">
                <div className="h-64 min-w-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={a.monthlyCompletion}
                      margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="currentColor"
                        className="text-border"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        className="text-muted-foreground"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        className="text-muted-foreground"
                        tickFormatter={(v: number) => `${v}%`}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                        contentStyle={tooltipStyle}
                        formatter={(value: number | string) => [`${value}%`, "Completion"]}
                      />
                      <Bar
                        dataKey="rate"
                        name="Completion"
                        fill={TEAL}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={48}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Category performance */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Category Performance</CardTitle>
              <CardDescription>Avg score by category (last 30 days)</CardDescription>
            </CardHeader>
            <CardContent>
              {a.categoryPerformance.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No category performance data"
                  description="No inspections recorded yet."
                />
              ) : (
                <div className="w-full overflow-x-auto">
                  <div className="h-64 min-w-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={a.categoryPerformance}
                        margin={{ top: 4, right: 8, left: -20, bottom: 8 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="currentColor"
                          className="text-border"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="category"
                          tickLine={false}
                          axisLine={false}
                          fontSize={11}
                          className="text-muted-foreground"
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                          height={50}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tickLine={false}
                          axisLine={false}
                          fontSize={12}
                          className="text-muted-foreground"
                          tickFormatter={(v: number) => `${v}%`}
                        />
                        <Tooltip
                          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                          contentStyle={tooltipStyle}
                          formatter={(
                            value: number | string,
                            _name,
                            item
                          ) => {
                            const row = item?.payload as
                              | { inspections?: number }
                              | undefined
                            const insp = row?.inspections ?? 0
                            return [
                              `${value}% · ${insp} inspections`,
                              "Avg score",
                            ]
                          }}
                        />
                        <Bar
                          dataKey="avgScore"
                          name="Avg Score"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={48}
                        >
                          {a.categoryPerformance.map((c) => (
                            <Cell key={c.category} fill={c.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Department performance */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Department Performance</CardTitle>
              <CardDescription>Inspections and avg score by department</CardDescription>
            </CardHeader>
            <CardContent>
              {a.departmentPerformance.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="No department data"
                  description="No department inspections recorded."
                />
              ) : (
                <div className="max-h-72 overflow-y-auto scrollbar-thin">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department</TableHead>
                        <TableHead className="text-right">Inspections</TableHead>
                        <TableHead className="text-right">Avg Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {a.departmentPerformance.map((d) => (
                        <TableRow key={d.department}>
                          <TableCell className="font-medium">{d.department}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {d.inspections}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                "inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                                scoreTone(d.avgScore)
                              )}
                            >
                              {d.avgScore}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Most failed machines */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Most Failed Machines</CardTitle>
              <CardDescription>Top failures in last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {a.mostFailedMachines.length === 0 ? (
                <EmptyState
                  icon={Wrench}
                  title="No failures recorded"
                  description="Everything passed — great work!"
                />
              ) : (
                <ul className="space-y-3">
                  {a.mostFailedMachines.map((m, i) => {
                    const pct =
                      maxFailures === 0
                        ? 0
                        : Math.round((m.failures / maxFailures) * 100)
                    return (
                      <li key={m.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-[10px] font-bold text-red-700 dark:text-red-400">
                              {i + 1}
                            </span>
                            <span className="truncate font-medium">{m.name}</span>
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {m.failures} failures
                          </span>
                        </div>
                        <div
                          className="h-2 w-full overflow-hidden rounded-full bg-red-500/10"
                          role="progressbar"
                          aria-valuenow={m.failures}
                          aria-valuemin={0}
                          aria-valuemax={maxFailures}
                          aria-label={`${m.failures} failures`}
                        >
                          <div
                            className="h-full rounded-full bg-red-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top pending inspections */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Top Pending Inspections</CardTitle>
              <CardDescription>Daily locations not yet inspected today</CardDescription>
            </CardHeader>
            <CardContent>
              {a.topPending.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="All caught up!"
                  description="No pending daily inspections right now."
                />
              ) : (
                <ul className="max-h-72 space-y-3 overflow-y-auto scrollbar-thin pr-1">
                  {a.topPending.map((p, i) => (
                    <li
                      key={`${p.name}-${i}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.machineName} · {frequencyLabel(p.frequency)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0",
                          p.lastDays >= 99
                            ? "border-red-500/40 text-red-700 dark:text-red-400"
                            : p.lastDays >= 2
                              ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                              : "border-muted-foreground/30 text-muted-foreground"
                        )}
                      >
                        {p.lastDays >= 99 ? "Never inspected" : `${p.lastDays}d ago`}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Most active employees */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Most Active Employees</CardTitle>
              <CardDescription>Top contributors in last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {a.topEmployees.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No activity yet"
                  description="Employee inspections will appear here."
                />
              ) : (
                <ul className="space-y-3">
                  {a.topEmployees.map((e, i) => {
                    const pct =
                      maxEmployeeCount === 0
                        ? 0
                        : Math.round((e.count / maxEmployeeCount) * 100)
                    return (
                      <li key={e.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                              {i + 1}
                            </span>
                            <span className="truncate font-medium">{e.name}</span>
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {e.count} inspections
                          </span>
                        </div>
                        <div
                          className="h-2 w-full overflow-hidden rounded-full bg-primary/10"
                          role="progressbar"
                          aria-valuenow={e.count}
                          aria-valuemin={0}
                          aria-valuemax={maxEmployeeCount}
                          aria-label={`${e.count} inspections`}
                        >
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
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
    </div>
  )
}
