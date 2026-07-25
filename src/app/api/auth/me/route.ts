import { getSessionUser } from "@/lib/auth"
import { json, toSafeUser } from "@/lib/api-helpers"

export async function GET(req: Request) {
  const user = await getSessionUser(req)
  if (!user) return json({ user: null })
  return json({ user: toSafeUser(user) })
}
