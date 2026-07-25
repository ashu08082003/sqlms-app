/**
 * Clean all demo / transactional data for a production deployment.
 *
 * Removes:  all inspections, all email logs, all demo employees, all demo locations
 * Keeps:    the admin account, categories, default checklists, departments
 *           (structural templates the admin builds on)
 */
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function clean() {
  console.log("Cleaning demo data for production deployment…")

  // 1. Email logs (depend on inspections)
  const emails = await db.emailLog.deleteMany({})
  console.log(`  Deleted ${emails.count} email logs`)

  // 2. Inspections
  const inspections = await db.inspection.deleteMany({})
  console.log(`  Deleted ${inspections.count} inspections`)

  // 3. Locations (demo QR locations)
  const locations = await db.location.deleteMany({})
  console.log(`  Deleted ${locations.count} locations`)

  // 4. Demo employees (keep ADMIN role accounts)
  const employees = await db.user.deleteMany({ where: { role: "EMPLOYEE" } })
  console.log(`  Deleted ${employees.count} demo employees`)

  // Summary of what remains
  const remaining = {
    admins: await db.user.count({ where: { role: "ADMIN" } }),
    categories: await db.category.count(),
    checklists: await db.checklist.count(),
    departments: await db.department.count(),
    locations: await db.location.count(),
    users: await db.user.count(),
    inspections: await db.inspection.count(),
    emails: await db.emailLog.count(),
  }
  console.log("\nRemaining data (production-ready):")
  console.log(JSON.stringify(remaining, null, 2))
  console.log("\n✓ Database is clean and ready for production.")
  console.log("  Admin login: admin@plant.com / admin123 (change this in production!)")
}

clean()
  .catch((e) => {
    console.error("Clean failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
    process.exit(0)
  })
