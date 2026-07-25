import { db } from "@/lib/db"
import { json, requireAuth } from "@/lib/api-helpers"
import type { Analytics } from "@/lib/types"

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export async function GET() {
  const auth = await requireAuth()
  if (!auth) return json({ error: "Unauthorized" }, 401)
  if (auth.safe.role !== "ADMIN") return json({ error: "Admin access required" }, 403)

  const now = new Date()
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const since180 = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)

  const [inspections30, inspections180, dailyLocations, cats, depts] = await Promise.all([
    db.inspection.findMany({
      where: { inspectionDate: { gte: since30 } },
      include: { location: { include: { category: true, department: true } }, user: true },
    }),
    db.inspection.findMany({
      where: { inspectionDate: { gte: since180 } },
      include: { location: { include: { category: true } }, user: { include: { department: true } } },
    }),
    db.location.findMany({ where: { active: true, frequency: "DAILY" }, select: { id: true, name: true, machineName: true, frequency: true } }),
    db.category.findMany(),
    db.department.findMany(),
  ])

  // Most failed machines
  const failMap = new Map<string, number>()
  for (const i of inspections30) {
    failMap.set(i.location.machineName, (failMap.get(i.location.machineName) ?? 0) + i.failedCount)
  }
  const mostFailedMachines = [...failMap.entries()]
    .map(([name, failures]) => ({ name, failures }))
    .filter((x) => x.failures > 0)
    .sort((a, b) => b.failures - a.failures)
    .slice(0, 5)

  // Top pending: daily locations with no inspection today, prioritise those with no recent inspection
  const todayStart = startOfDay(now)
  const todayLocIds = new Set(inspections30.filter((i) => i.inspectionDate >= todayStart).map((i) => i.locationId))
  const pendingLocs = dailyLocations.filter((l) => !todayLocIds.has(l.id))
  const lastInspMap = new Map<string, Date>()
  for (const i of inspections30) {
    const cur = lastInspMap.get(i.locationId)
    if (!cur || i.inspectionDate > cur) lastInspMap.set(i.locationId, i.inspectionDate)
  }
  const topPending = pendingLocs
    .map((l) => ({
      name: l.name,
      machineName: l.machineName,
      frequency: l.frequency,
      lastDays: lastInspMap.has(l.id)
        ? Math.floor((now.getTime() - lastInspMap.get(l.id)!.getTime()) / (24 * 3600 * 1000))
        : 99,
    }))
    .sort((a, b) => b.lastDays - a.lastDays)
    .slice(0, 5)

  // Average completion time-of-day
  const hours: number[] = []
  for (const i of inspections30) {
    hours.push(i.inspectionDate.getHours() + i.inspectionDate.getMinutes() / 60)
  }
  let avgCompletionTime = "—"
  if (hours.length > 0) {
    const avg = hours.reduce((a, b) => a + b, 0) / hours.length
    const h = Math.floor(avg)
    const m = Math.round((avg - h) * 60)
    const date = new Date()
    date.setHours(h, m, 0, 0)
    avgCompletionTime = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  }

  // Average score
  const scores = inspections30.map((i) => i.score)
  const averageScore = scores.length === 0 ? 0 : Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10

  // Top employees
  const empMap = new Map<string, number>()
  for (const i of inspections30) empMap.set(i.user.name, (empMap.get(i.user.name) ?? 0) + 1)
  const topEmployees = [...empMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Monthly completion (last 6 months)
  const monthlyCompletion: { month: string; rate: number }[] = []
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1)
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1)
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const monthInsps = inspections180.filter((i) => i.inspectionDate >= mStart && i.inspectionDate < mEnd)
    const locIds = new Set(monthInsps.map((i) => i.locationId))
    const rate = dailyLocations.length === 0 ? 0 : Math.round((locIds.size / dailyLocations.length) * 1000) / 10
    monthlyCompletion.push({
      month: d.toLocaleDateString("en-US", { month: "short" }),
      rate,
    })
  }

  // Department performance
  const deptPerf = new Map<string, { inspections: number; scoreSum: number }>()
  for (const d of depts) deptPerf.set(d.name, { inspections: 0, scoreSum: 0 })
  for (const i of inspections30) {
    const dn = i.location.department?.name
    if (!dn) continue
    const cur = deptPerf.get(dn)
    if (cur) {
      cur.inspections++
      cur.scoreSum += i.score
    }
  }
  const departmentPerformance = [...deptPerf.entries()]
    .map(([department, v]) => ({
      department,
      inspections: v.inspections,
      avgScore: v.inspections === 0 ? 0 : Math.round((v.scoreSum / v.inspections) * 10) / 10,
    }))
    .filter((x) => x.inspections > 0)
    .sort((a, b) => b.inspections - a.inspections)

  // Category performance
  const catPerf = new Map<string, { inspections: number; scoreSum: number; color: string }>()
  for (const c of cats) catPerf.set(c.name, { inspections: 0, scoreSum: 0, color: c.color })
  for (const i of inspections30) {
    const cn = i.location.category.name
    const cur = catPerf.get(cn)
    if (cur) {
      cur.inspections++
      cur.scoreSum += i.score
    }
  }
  const categoryPerformance = [...catPerf.entries()]
    .map(([category, v]) => ({
      category,
      inspections: v.inspections,
      avgScore: v.inspections === 0 ? 0 : Math.round((v.scoreSum / v.inspections) * 10) / 10,
      color: v.color,
    }))
    .filter((x) => x.inspections > 0)
    .sort((a, b) => b.inspections - a.inspections)

  const analytics: Analytics = {
    mostFailedMachines,
    topPending,
    avgCompletionTime,
    averageScore,
    topEmployees,
    monthlyCompletion,
    departmentPerformance,
    categoryPerformance,
  }

  return json({ analytics })
}
