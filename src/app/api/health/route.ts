import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * Health check endpoint for Railway / uptime monitors.
 * Verifies the server is up AND the database is reachable.
 * Returns 200 when healthy, 503 when the DB connection fails.
 */
export async function GET() {
  try {
    // Lightweight DB ping to confirm connectivity
    await db.$queryRaw`SELECT 1`
    return NextResponse.json(
      { status: "ok", db: "connected", timestamp: new Date().toISOString() },
      { status: 200 }
    )
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        db: "unreachable",
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
