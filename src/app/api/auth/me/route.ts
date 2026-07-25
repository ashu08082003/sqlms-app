import { getSessionUser } from "@/lib/auth"
import { json, toSafeUser } from "@/lib/api-helpers"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return json({ user: null })
  return json({ user: toSafeUser(user) })
}
