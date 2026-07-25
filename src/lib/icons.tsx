import { createElement } from "react"
import {
  Cog,
  Sparkles,
  ShieldCheck,
  Zap,
  Fuel,
  Warehouse,
  BadgeCheck,
  Tag,
  Factory,
  Wrench,
  Tractor,
  Flame,
  Gauge,
  Boxes,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react"

const MAP: Record<string, LucideIcon> = {
  Cog,
  Sparkles,
  ShieldCheck,
  Zap,
  Fuel,
  Warehouse,
  BadgeCheck,
  Tag,
  Factory,
  Wrench,
  Tractor,
  Flame,
  Gauge,
  Boxes,
  ClipboardCheck,
}

export function getIcon(name: string): LucideIcon {
  return MAP[name] ?? Tag
}

/**
 * Renders the lucide icon for a category icon name.
 * Uses createElement so we never alias a component to a PascalCase
 * variable during render (which the React compiler lint flags).
 */
export function CategoryIcon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return createElement(getIcon(name), { className })
}
