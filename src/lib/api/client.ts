import type { ApiErrorPayload, ApiResponse } from "@/types/api"

export class ApiClientError extends Error {
  code: string
  hint?: string
  details?: string
  status: number

  constructor(payload: ApiErrorPayload, status: number) {
    super(payload.message)
    this.name = "ApiClientError"
    this.code = payload.code
    this.hint = payload.hint
    this.details = payload.details
    this.status = status
  }
}

export async function fetchApi<T>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  })

  const json = (await response.json()) as ApiResponse<T>

  if (!response.ok || !json.ok) {
    const payload =
      "error" in json
        ? json.error
        : {
            code: "HTTP_ERROR",
            message: "요청 처리에 실패했습니다.",
          }

    throw new ApiClientError(payload, response.status)
  }

  return json.data
}
