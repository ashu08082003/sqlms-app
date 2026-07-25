import { seedDatabase } from "../src/lib/seed-data"

const result = await seedDatabase()
console.log("Seed result:", JSON.stringify(result, null, 2))
process.exit(0)
