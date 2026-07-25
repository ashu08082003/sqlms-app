import type { Frequency, ItemStatus } from "@/lib/types"

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
]

export function frequencyLabel(f: string): string {
  return FREQUENCIES.find((x) => x.value === f)?.label ?? f
}

export const STATUS_META: Record<
  ItemStatus,
  { label: string; color: string; bg: string; ring: string }
> = {
  OK: {
    label: "OK",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-500",
    ring: "ring-emerald-500/30",
  },
  NOT_OK: {
    label: "Not OK",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-500",
    ring: "ring-red-500/30",
  },
  NA: {
    label: "N/A",
    color: "text-zinc-500 dark:text-zinc-400",
    bg: "bg-zinc-400",
    ring: "ring-zinc-400/30",
  },
}

/* Default categories with lucide icon names + tailwind-friendly hex colors (no blue/indigo) */
export const DEFAULT_CATEGORIES: {
  name: string
  slug: string
  icon: string
  color: string
  description: string
}[] = [
  { name: "Machine", slug: "machine", icon: "Cog", color: "#0d9488", description: "Production machinery & equipment" },
  { name: "Housekeeping", slug: "housekeeping", icon: "Sparkles", color: "#0891b2", description: "Washrooms, floors, cleanliness" },
  { name: "Safety", slug: "safety", icon: "ShieldCheck", color: "#dc2626", description: "Fire safety, PPE, hazard checks" },
  { name: "Electrical", slug: "electrical", icon: "Zap", color: "#ca8a04", description: "Panels, MCBs, cabling" },
  { name: "Utility", slug: "utility", icon: "Fuel", color: "#9333ea", description: "DG, compressors, water" },
  { name: "Warehouse", slug: "warehouse", icon: "Warehouse", color: "#16a34a", description: "Forklifts, racks, material" },
  { name: "Quality", slug: "quality", icon: "BadgeCheck", color: "#ea580c", description: "Gauges, calibration, inspection" },
]

export const DEFAULT_CHECKLISTS: {
  name: string
  categorySlug: string
  frequency: Frequency
  description: string
  items: string[]
}[] = [
  {
    name: "Machine Daily Checklist",
    categorySlug: "machine",
    frequency: "DAILY",
    description: "Standard daily machine inspection",
    items: ["Greasing", "Oil Level", "Hydraulic Pressure", "Air Pressure", "Belt Condition", "Guard", "Cleaning", "Emergency Switch"],
  },
  {
    name: "Washroom Checklist",
    categorySlug: "housekeeping",
    frequency: "DAILY",
    description: "Washroom hygiene & supplies",
    items: ["Floor", "Soap", "Tissue", "Dustbin", "Mirror", "Water", "Air Freshener"],
  },
  {
    name: "Forklift Inspection",
    categorySlug: "warehouse",
    frequency: "DAILY",
    description: "Pre-use forklift safety check",
    items: ["Horn", "Brake", "Battery", "Tyre", "Hydraulic", "Reverse Alarm"],
  },
  {
    name: "Fire Extinguisher Check",
    categorySlug: "safety",
    frequency: "MONTHLY",
    description: "Monthly fire extinguisher inspection",
    items: ["Pressure", "Seal", "Expiry", "Pin", "Stand", "Visibility"],
  },
  {
    name: "Electrical Panel Inspection",
    categorySlug: "electrical",
    frequency: "WEEKLY",
    description: "Weekly electrical panel safety check",
    items: ["Door Locked", "Temperature", "Cleaning", "MCB Status", "Cable Tightness", "Indicator"],
  },
  {
    name: "DG Set Inspection",
    categorySlug: "utility",
    frequency: "WEEKLY",
    description: "Diesel generator weekly check",
    items: ["Fuel Level", "Oil Level", "Battery", "Coolant", "Exhaust", "Control Panel"],
  },
]

/* ---------------- JSON field helpers (SQLite stores as String) ---------------- */
export function parseItems(items: string | null | undefined): string[] {
  if (!items) return []
  try {
    const parsed = JSON.parse(items)
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : []
  } catch {
    return []
  }
}

export function stringifyItems(items: string[]): string {
  return JSON.stringify(items)
}

export function parseResponses(responses: string | null | undefined): {
  item: string
  status: "OK" | "NOT_OK" | "NA"
  reason?: string
  photoUrl?: string
}[] {
  if (!responses) return []
  try {
    const parsed = JSON.parse(responses)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function stringifyResponses(responses: unknown[]): string {
  return JSON.stringify(responses)
}

/* QR code helpers */
export function formatQrCode(num: number): string {
  return `QR${String(num).padStart(6, "0")}`
}
