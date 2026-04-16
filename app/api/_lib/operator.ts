import { cookies } from "next/headers";

export async function getOperator(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get("operator")?.value?.trim();
  return value ? value : null;
}
