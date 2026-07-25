"use client"

import { create } from "zustand"
import type { SafeUser } from "@/lib/types"

export type AdminSection =
  | "dashboard"
  | "locations"
  | "checklists"
  | "categories"
  | "users"
  | "inspections"
  | "analytics"
  | "email"

interface AppState {
  user: SafeUser | null
  setUser: (u: SafeUser | null) => void

  // Admin navigation
  section: AdminSection
  setSection: (s: AdminSection) => void

  // Sidebar collapse (mobile)
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void

  // Bump to force refetches after mutations
  refreshKey: number
  bump: () => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (u) => set({ user: u }),

  section: "dashboard",
  setSection: (s) => set({ section: s }),

  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  refreshKey: 0,
  bump: () => set((st) => ({ refreshKey: st.refreshKey + 1 })),
}))
