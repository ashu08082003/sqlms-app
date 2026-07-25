import { db } from "@/lib/db"
import { hashPassword, verifyPassword, setSession } from "@/lib/auth"
import { error, json, toSafeUser } from "@/lib/api-helpers"
import { getSessionUser } from "@/lib/auth"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { email, password } = body as { email?: string; password?: string }
  if (!email || !password) return error("Email and password are required", 400)

  let user = await db.user.findUnique({
    where: { email: String(email).toLowerCase().trim() },
    include: { department: true },
  })

  // Auto-provision the first admin if none exist (bootstrap convenience)
  if (!user) {
    const userCount = await db.user.count()
    if (userCount === 0 && email.toLowerCase() === "admin@plant.com") {
      user = await db.user.create({
        data: {
          email: "admin@plant.com",
          name: "System Administrator",
          passwordHash: hashPassword("admin123"),
          role: "ADMIN",
          employeeCode: "ADM-001",
        },
        include: { department: true },
      })
    }
  }

  if (!user) return error("Invalid credentials", 401)
  if (!user.active) return error("Account is deactivated", 403)
  if (!verifyPassword(password, user.passwordHash)) return error("Invalid credentials", 401)

  const token = await setSession(user.id)
  return json({ user: toSafeUser(user), token })
}

// Get current session
export async function GET(req: Request) {
  const user = await getSessionUser(req)
  if (!user) return json({ user: null })
  return json({ user: toSafeUser(user) })
}
