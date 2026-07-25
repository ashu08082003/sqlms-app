import { db } from "@/lib/db"
import { json, requireAuth } from "@/lib/api-helpers"
import type { DashboardStats } from "@/lib/types"

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export async function GET() {
  const auth = await requireAuth()
  if (!auth) return json({ error: "Unauthorized" }, 401)

  const now = new Date()
  const todayStart = startOfDay(now)
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
  const twoDaysAgoStart = new Date(todayStart.getTime() - 2 * 24 * 60 * 60 * 1000)

  const [totalLocations, dailyLocations, inspectionsToday, recentInspections] =
    await Promise.all([
      db.location.count({ where: { active: true } }),
      db.location.findMany({
        where: { active: true, frequency: "DAILY" },
        select: { id: true },
      }),
      db.inspection.findMany({
        where: { inspectionDate: { gte: todayStart } },
        select: { locationId: true, id: true },
      }),
      db.inspection.findMany({
        take: 8,
        orderBy: { inspectionDate: "desc" },
        include: {
          location: { include: { category: true } },
          user: true,
        },
      }),
    ])

  const dailyLocationIds = new Set(dailyLocations.map((l) => l.id))
  // "Today's completed" counts only DAILY locations inspected today
  // (weekly/monthly locations are not due every day, so they shouldn't
  // inflate the daily completion metric).
  const inspectedTodayIds = new Set(
    inspectionsToday.filter((i) => dailyLocationIds.has(i.locationId)).map((i) => i.locationId)
  )
  const completedToday = inspectedTodayIds.size
  const pendingToday = Math.max(0, dailyLocations.length - completedToday)

  // Overdue: daily locations with no inspection in the last 2 days
  const recent2d = await db.inspection.findMany({
    where: { inspectionDate: { gte: twoDaysAgoStart } },
    select: { locationId: true },
  })
  const inspected2dIds = new Set(recent2d.map((i) => i.locationId))
  const overdue = dailyLocations.filter((l) => !inspected2dIds.has(l.id)).length

  const completionRate =
    dailyLocations.length === 0
      ? 0
      : Math.round((completedToday / dailyLocations.length) * 1000) / 10

  const totalInspections = await db.inspection.count()

  // Category breakdown (last 30 days)
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const cats = await db.category.findMany({ include: { locations: true } })
  const inspections30 = await db.inspection.findMany({
    where: { inspectionDate: { gte: since30 } },
    include: { location: { include: { category: true } } },
  })
  const catCount = new Map<string, { count: number; color: string }>()
  for (const c of cats) catCount.set(c.name, { count: 0, color: c.color })
  for (const insp of inspections30) {
    const cn = insp.location.category.name
    const cur = catCount.get(cn)
    if (cur) cur.count++
  }
  const categoryBreakdown = [...catCount.entries()]
    .map(([category, v]) => ({ category, count: v.count, color: v.color }))
    .sort((a, b) => b.count - a.count)

  // Last 7 days
  const last7Days: { day: string; completed: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
    const count = await db.inspection.count({
      where: { inspectionDate: { gte: dayStart, lt: dayEnd } },
    })
    last7Days.push({
      day: dayStart.toLocaleDateString("en-US", { weekday: "short" }),
      completed: count,
    })
  }

  const recentActivities = recentInspections.map((i) => ({
    id: i.id,
    locationName: i.location.name,
    machineName: i.location.machineName,
    categoryName: i.location.category.name,
    userName: i.user.name,
    time: i.inspectionDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    score: i.score,
    failedCount: i.failedCount,
  }))

  const stats: DashboardStats = {
    totalLocations,
    completedToday,
    pendingToday,
    overdue,
    completionRate,
    totalInspections,
    categoryBreakdown,
    last7Days,
    recentActivities,
  }

  return json({ stats })
}
