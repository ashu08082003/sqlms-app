import { seedDatabase } from "../src/lib/seed-data"

async function main() {
  try {
    const result = await seedDatabase()
    console.log("Seed result:", JSON.stringify(result, null, 2))
  } catch (error) {
    console.error("Seed error (non-fatal):", error)
  }
}

void main().then(() => process.exit(0))
