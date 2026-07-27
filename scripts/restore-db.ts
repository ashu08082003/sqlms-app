/**
 * Restore the SQLMS database from a backup file.
 *
 * Usage:
 *   bun run scripts/restore-db.ts                          # restore latest backup
 *   bun run scripts/restore-db.ts custom-2026-07-27_03-55-19.db  # restore specific backup
 *
 * IMPORTANT: This overwrites the current database. A backup of the current
 * state is made automatically before restoring.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs"
import { join } from "path"

const DB_PATH = "/home/z/my-project/db/custom.db"
const BACKUP_DIR = "/home/z/my-project/db/backups"

function backupCurrent() {
  if (!existsSync(DB_PATH)) return null
  mkdirSync(BACKUP_DIR, { recursive: true })
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19)
  const preRestorePath = join(BACKUP_DIR, `pre-restore-${ts}.db`)
  copyFileSync(DB_PATH, preRestorePath)
  console.log(`✓ Current database backed up to: ${preRestorePath}`)
  return preRestorePath
}

function restore(filename?: string) {
  let backupPath: string

  if (filename) {
    // Use specific backup
    backupPath = filename.startsWith("/")
      ? filename
      : join(BACKUP_DIR, filename)
    if (!existsSync(backupPath)) {
      console.error(`Backup file not found: ${backupPath}`)
      console.log("\nAvailable backups:")
      const backups = listBackups()
      backups.forEach((b) => console.log(`  ${b.name}  (${(b.size / 1024).toFixed(1)} KB, ${b.mtime.toISOString()})`))
      process.exit(1)
    }
  } else {
    // Use latest backup
    const backups = listBackups()
    if (backups.length === 0) {
      console.error("No backups found in", BACKUP_DIR)
      process.exit(1)
    }
    // Skip pre-restore backups when looking for the latest
    const regularBackups = backups.filter((b) => !b.name.startsWith("pre-restore-"))
    if (regularBackups.length === 0) {
      console.error("No regular backups found (only pre-restore backups exist)")
      process.exit(1)
    }
    backupPath = regularBackups[0].path
  }

  console.log(`Restoring from: ${backupPath}`)

  // Safety backup first
  backupCurrent()

  // Restore
  copyFileSync(backupPath, DB_PATH)
  console.log(`✓ Database restored from: ${backupPath}`)
  console.log(`  Restored to: ${DB_PATH}`)
  console.log("\nRestart the dev server for changes to take effect: bun run dev")
}

function listBackups() {
  return readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".db"))
    .map((f) => ({
      name: f,
      path: join(BACKUP_DIR, f),
      size: statSync(join(BACKUP_DIR, f)).size,
      mtime: statSync(join(BACKUP_DIR, f)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
}

const argFilename = process.argv[2]
restore(argFilename)
