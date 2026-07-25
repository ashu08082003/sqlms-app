"use client"
import { CategoryIcon } from "@/lib/icons"
import { cn } from "@/lib/utils"

export function CategoryBadge({
  icon,
  color,
  name,
  size = "md",
}: {
  icon: string
  color: string
  name?: string
  size?: "sm" | "md"
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-lg text-white",
          size === "sm" ? "h-7 w-7" : "h-9 w-9"
        )}
        style={{ backgroundColor: color }}
      >
        <CategoryIcon
          name={icon}
          className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"}
        />
      </span>
      {name && <span className="font-medium">{name}</span>}
    </span>
  )
}
