export type Role = "ADMIN" | "EMPLOYEE"

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY"

export type ItemStatus = "OK" | "NOT_OK" | "NA"

export interface ChecklistItemDef {
  label: string
}

export interface InspectionResponse {
  item: string
  status: ItemStatus
  reason?: string
  photoUrl?: string
}

export interface SafeUser {
  id: string
  email: string
  name: string
  role: Role
  employeeCode: string | null
  phone: string | null
  departmentId: string | null
  departmentName: string | null
  active: boolean
}

export interface DashboardStats {
  totalLocations: number
  completedToday: number
  pendingToday: number
  overdue: number
  completionRate: number
  totalInspections: number
  categoryBreakdown: { category: string; count: number; color: string }[]
  last7Days: { day: string; completed: number }[]
  recentActivities: {
    id: string
    locationName: string
    machineName: string
    categoryName: string
    userName: string
    time: string
    score: number
    failedCount: number
  }[]
}

export interface Analytics {
  mostFailedMachines: { name: string; failures: number }[]
  topPending: { name: string; machineName: string; frequency: string }[]
  avgCompletionTime: string
  averageScore: number
  topEmployees: { name: string; count: number }[]
  monthlyCompletion: { month: string; rate: number }[]
  departmentPerformance: { department: string; inspections: number; avgScore: number }[]
  categoryPerformance: { category: string; inspections: number; avgScore: number; color: string }[]
}
