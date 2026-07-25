import { json } from "@/lib/api-helpers"
import { seedDatabase } from "@/lib/seed-data"

export async function POST() {
  const result = await seedDatabase()
  return json(result)
}

export async function GET() {
  const result = await seedDatabase()
  return json(result)
}
