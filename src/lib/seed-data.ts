import { db } from "@/lib/db"
import { hashPassword } from "@/lib/auth"
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CHECKLISTS,
  formatQrCode,
  stringifyItems,
  stringifyResponses,
} from "@/lib/constants"
import type { Frequency } from "@/lib/types"

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

export async function seedDatabase(options: { includeDemo?: boolean } = {}) {
  const includeDemo = options.includeDemo ?? false
  const deptNames = [
    "Production",
    "Maintenance",
    "Housekeeping",
    "Safety",
    "Electrical",
    "Warehouse",
    "Quality",
  ]
  const departments = [] as { id: string; name: string }[]
  for (const name of deptNames) {
    const d = await db.department.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name} department` },
    })
    departments.push(d)
  }

  const adminEmail = "admin@plant.com"
  let admin = await db.user.findUnique({ where: { email: adminEmail } })
  if (!admin) {
    admin = await db.user.create({
      data: {
        email: adminEmail,
        name: "System Administrator",
        passwordHash: hashPassword("admin123"),
        role: "ADMIN",
        employeeCode: "ADM-001",
        departmentId: departments[0].id,
      },
    })
  }

  const employees = [] as { id: string; name: string; deptId: string }[]
  if (includeDemo) {
    const empDefs = [
      { name: "Ashutosh Kumar", code: "EMP-001", dept: "Production" },
      { name: "Rakesh Sharma", code: "EMP-002", dept: "Housekeeping" },
      { name: "Vikram Singh", code: "EMP-003", dept: "Maintenance" },
      { name: "Priya Patel", code: "EMP-004", dept: "Safety" },
      { name: "Mohit Verma", code: "EMP-005", dept: "Electrical" },
      { name: "Sneha Reddy", code: "EMP-006", dept: "Warehouse" },
    ]
    for (const e of empDefs) {
      const email = `${e.code.toLowerCase().replace("-", ".")}@plant.com`
      let user = await db.user.findUnique({ where: { email } })
      const dept = departments.find((d) => d.name === e.dept)!
      if (!user) {
        user = await db.user.create({
          data: {
            email,
            name: e.name,
            passwordHash: hashPassword("emp123"),
            role: "EMPLOYEE",
            employeeCode: e.code,
            departmentId: dept.id,
          },
        })
      }
      employees.push({ id: user.id, name: user.name, deptId: dept.id })
    }
  }

  const categoryMap = new Map<string, { id: string; name: string; color: string }>()
  for (const c of DEFAULT_CATEGORIES) {
    const cat = await db.category.upsert({
      where: { slug: c.slug },
      update: { icon: c.icon, color: c.color },
      create: {
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        color: c.color,
        description: c.description,
      },
    })
    categoryMap.set(c.slug, { id: cat.id, name: cat.name, color: cat.color })
  }

  const checklistMap = new Map<string, { id: string; name: string }>()
  for (const cl of DEFAULT_CHECKLISTS) {
    const cat = categoryMap.get(cl.categorySlug)!
    const existing = await db.checklist.findFirst({
      where: { name: cl.name, categoryId: cat.id },
    })
    let id: string
    if (existing) {
      await db.checklist.update({
        where: { id: existing.id },
        data: { items: stringifyItems(cl.items), frequency: cl.frequency, description: cl.description },
      })
      id = existing.id
    } else {
      const created = await db.checklist.create({
        data: {
          name: cl.name,
          categoryId: cat.id,
          description: cl.description,
          frequency: cl.frequency,
          items: stringifyItems(cl.items),
        },
      })
      id = created.id
    }
    checklistMap.set(cl.name, { id, name: cl.name })
  }

  const locations = [] as {
    id: string
    name: string
    machine: string
    catId: string
    catName: string
    checklistId: string
    freq: Frequency
  }[]
  if (includeDemo) {
    const locDefs = [
      { cat: "machine", name: "Slitting Line", machine: "Slitter-01", freq: "DAILY" as Frequency, cl: "Machine Daily Checklist", dept: "Production" },
      { cat: "machine", name: "Printing Press", machine: "Press-02", freq: "DAILY" as Frequency, cl: "Machine Daily Checklist", dept: "Production" },
      { cat: "machine", name: "Extruder Unit", machine: "Extruder-01", freq: "DAILY" as Frequency, cl: "Machine Daily Checklist", dept: "Production" },
      { cat: "housekeeping", name: "Washroom A", machine: "Washroom-A", freq: "DAILY" as Frequency, cl: "Washroom Checklist", dept: "Housekeeping" },
      { cat: "housekeeping", name: "Washroom B", machine: "Washroom-B", freq: "DAILY" as Frequency, cl: "Washroom Checklist", dept: "Housekeeping" },
      { cat: "warehouse", name: "Forklift Bay 1", machine: "Forklift-FL01", freq: "DAILY" as Frequency, cl: "Forklift Inspection", dept: "Warehouse" },
      { cat: "warehouse", name: "Forklift Bay 2", machine: "Forklift-FL02", freq: "DAILY" as Frequency, cl: "Forklift Inspection", dept: "Warehouse" },
      { cat: "safety", name: "Fire Extinguisher Main", machine: "FE-MAIN-01", freq: "MONTHLY" as Frequency, cl: "Fire Extinguisher Check", dept: "Safety" },
      { cat: "safety", name: "Fire Extinguisher Store", machine: "FE-STORE-02", freq: "MONTHLY" as Frequency, cl: "Fire Extinguisher Check", dept: "Safety" },
      { cat: "electrical", name: "Main Panel Room", machine: "Panel-Main", freq: "WEEKLY" as Frequency, cl: "Electrical Panel Inspection", dept: "Electrical" },
      { cat: "electrical", name: "Panel Shop Floor", machine: "Panel-Shop", freq: "WEEKLY" as Frequency, cl: "Electrical Panel Inspection", dept: "Electrical" },
      { cat: "utility", name: "DG Set Room", machine: "DG-01", freq: "WEEKLY" as Frequency, cl: "DG Set Inspection", dept: "Maintenance" },
    ]

    const locationCount = await db.location.count()
    let qrNum = locationCount + 1

    for (const ld of locDefs) {
      const cat = categoryMap.get(ld.cat)!
      const cl = checklistMap.get(ld.cl)!
      const dept = departments.find((d) => d.name === ld.dept)!
      const qrCode = formatQrCode(qrNum)
      qrNum++
      let loc = await db.location.findUnique({ where: { qrCode } })
      if (!loc) {
        loc = await db.location.create({
          data: {
            qrCode,
            categoryId: cat.id,
            name: ld.name,
            machineName: ld.machine,
            departmentId: dept.id,
            checklistId: cl.id,
            frequency: ld.freq,
          },
        })
      }
      locations.push({
        id: loc.id,
        name: loc.name,
        machine: loc.machineName,
        catId: cat.id,
        catName: cat.name,
        checklistId: cl.id,
        freq: ld.freq,
      })
    }
  }

  const existingInspections = await db.inspection.count()
  if (includeDemo && existingInspections === 0 && locations.length > 0) {
    const now = new Date()
    const checklistItemsMap = new Map<string, string[]>()
    for (const cl of DEFAULT_CHECKLISTS) checklistItemsMap.set(cl.name, cl.items)
    const itemsByChecklistId = new Map<string, string[]>()
    for (const [name, meta] of checklistMap.entries()) {
      itemsByChecklistId.set(meta.id, checklistItemsMap.get(name) ?? [])
    }

    const inspectionsToCreate: {
      locationId: string
      userId: string
      checklistId: string
      inspectionDate: Date
      responses: string
      remarks: string | null
      passedCount: number
      failedCount: number
      naCount: number
      score: number
      status: string
    }[] = []

    let empIdx = 0
    for (const loc of locations) {
      const items = itemsByChecklistId.get(loc.checklistId) ?? []
      const days = loc.freq === "DAILY" ? 7 : loc.freq === "WEEKLY" ? 4 : loc.freq === "MONTHLY" ? 3 : 2
      for (let d = 0; d < days; d++) {
        const date = new Date(now)
        if (loc.freq === "DAILY") date.setDate(now.getDate() - d)
        else if (loc.freq === "WEEKLY") date.setDate(now.getDate() - d * 7)
        else date.setMonth(now.getMonth() - d)
        date.setHours(8 + (d % 8), (d * 13) % 60, 0, 0)

        if (d === 0 && loc.freq === "DAILY" && loc.name.charCodeAt(0) % 3 === 0) continue

        const responses = items.map((item, idx) => {
          const seed = (loc.name.length + d + idx) % 10
          let status: "OK" | "NOT_OK" | "NA" = "OK"
          if (seed === 1) status = "NOT_OK"
          else if (seed === 2) status = "NA"
          const r: { item: string; status: "OK" | "NOT_OK" | "NA"; reason?: string } = { item, status }
          if (status === "NOT_OK") {
            r.reason = pick(
              ["Oil leakage found", "Belt worn out", "Pressure below threshold", "Guard loose", "Cleaning required"],
              idx + d
            )
          }
          return r
        })
        const passed = responses.filter((r) => r.status === "OK").length
        const failed = responses.filter((r) => r.status === "NOT_OK").length
        const na = responses.filter((r) => r.status === "NA").length
        const scoreDenom = passed + failed
        const score = scoreDenom === 0 ? 100 : Math.round((passed / scoreDenom) * 1000) / 10
        const emp = pick(employees, empIdx++)
        inspectionsToCreate.push({
          locationId: loc.id,
          userId: emp.id,
          checklistId: loc.checklistId,
          inspectionDate: date,
          responses: stringifyResponses(responses),
          remarks: failed > 0 ? "Issue reported to maintenance. Action initiated." : "All checks satisfactory.",
          passedCount: passed,
          failedCount: failed,
          naCount: na,
          score,
          status: "COMPLETED",
        })
      }
    }

    for (let i = 0; i < inspectionsToCreate.length; i += 50) {
      await db.inspection.createMany({ data: inspectionsToCreate.slice(i, i + 50) })
    }
  }

  // Default email settings (simulate-only by default; admin can switch to live SMTP)
  await db.emailSetting.upsert({
    where: { key: "global" },
    update: {},
    create: {
      key: "global",
      reportToEmail: "reports@plant.com",
      escalationToEmail: "maintenance@plant.com",
      fromName: "SQLMS Logbook",
      enableReportEmail: true,
      enableEscalation: true,
      simulateOnly: true,
    },
  })

  // Backfill: generate email log entries for the 6 most recent inspections
  // (only when demo data was seeded, so the admin can immediately see what
  // report + escalation emails look like).
  if (includeDemo) {
    const recent = await db.inspection.findMany({
      take: 6,
      orderBy: { inspectionDate: "desc" },
      include: {
        location: { include: { category: true, department: true } },
        user: true,
      },
    })
    if ((await db.emailLog.count()) === 0 && recent.length > 0) {
      const { sendInspectionEmails } = await import("@/lib/email")
      for (const insp of recent) {
        try {
          await sendInspectionEmails(insp.id)
        } catch {
          /* ignore backfill errors */
        }
      }
    }
  }

  return {
    ok: true,
    message: "Seed complete",
    counts: {
      departments: departments.length,
      users: employees.length + 1,
      categories: categoryMap.size,
      checklists: checklistMap.size,
      locations: locations.length,
    },
  }
}
