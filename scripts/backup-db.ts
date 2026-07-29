/**
 * Backup the SQLMS database to a timestamped file.
 * Run this before any maintenance or periodically to protect your data.
 *
 * Usage: bun run scripts/backup-db.ts
 */
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync, unlinkSync } from "fs"
import { join } from "path"

const DB_PATH = process.env.DATABASE_URL
  ?.replace("file:", "")
  || "/app/db/custom.db"

const BACKUP_DIR = process.cwd() + "/db/backups"

function backup() {
  if (!existsSync(DB_PATH)) {
    console.error("Database file not found:", DB_PATH)
    process.exit(1)
  }

  mkdirSync(BACKUP_DIR, { recursive: true })

  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19)

  const backupPath = join(BACKUP_DIR, `custom-${ts}.db`)
  copyFileSync(DB_PATH, backupPath)

  console.log(`✓ Database backed up to: ${backupPath}`)
  console.log(`  Original: ${DB_PATH}`)

  // Keep only the last 10 backups, delete older ones
  const backups = readdirSync(BACKUP_DIR)
    .filter((f: string) => f.startsWith("custom-") && f.endsWith(".db"))
    .map((f: string) => ({ name: f, path: join(BACKUP_DIR, f), mtime: statSync(join(BACKUP_DIR, f)).mtime }))
    .sort((a: { mtime: number }, b: { mtime: number }) => b.mtime - a.mtime)

  if (backups.length > 10) {
    const toDelete = backups.slice(10)
    for (const b of toDelete) {
      unlinkSync(b.path)
      console.log(`  Deleted old backup: ${b.name}`)
    }
  }
}

backup()
