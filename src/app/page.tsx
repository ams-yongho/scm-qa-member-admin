import { MemberAdminPage } from "@/components/member-admin-page"
import { getRuntimeEnv } from "@/lib/env"

export const dynamic = "force-dynamic"

export default function Home() {
  const runtimeEnv = getRuntimeEnv()

  return <MemberAdminPage defaultTarget={runtimeEnv.DEFAULT_SERVER_TARGET} />
}
