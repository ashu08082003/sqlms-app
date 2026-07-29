import { NextResponse } from "next/server"
import { readFileSync, existsSync } from "fs"
import { join } from "path"

export const dynamic = "force-dynamic"

export async function GET() {
  // Determine the database path - check Railway volume path first, then fallback
  const possiblePaths = [
    "/app/db/custom.db",
    join(process.cwd(), "db", "custom.db"),
    join(process.cwd(), "prisma", "db", "custom.db"),
  ]

  let dbPath: string | null = null
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      dbPath = p
      break
    }
  }

  if (!dbPath) {
    return NextResponse.json(
      { error: "Database file not found on server" },
      { status: 404 }
    )
  }

  try {
    const dbBuffer = readFileSync(dbPath)
    const stats = (await import("fs")).statSync(dbPath)
    const sizeKB = (stats.size / 1024).toFixed(1)

    return new NextResponse(dbBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="sqlms-db-backup-${new Date().toISOString().split("T")[0]}.db"`,
        "Content-Length": stats.size.toString(),
        "X-DB-Size-KB": sizeKB,
        "X-DB-Path": dbPath,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to read database: ${(error as Error).message}` },
      { status: 500 }
    )
  }
}

