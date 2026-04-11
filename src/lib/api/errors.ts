import "server-only"

import { NextResponse } from "next/server"
import { ZodError } from "zod"

import { ReadOnlyTargetError } from "@/lib/db/targets"
import type { ApiErrorPayload, ApiFailure, ApiSuccess } from "@/types/api"

const DB_TROUBLESHOOTING_HINT =
  "Azure MySQL 방화벽/VNet 허용 여부, 3306 outbound 개방, TLS 1.2 설정을 확인하세요."

function getErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return undefined
  }

  if ("code" in error && typeof error.code === "string") {
    return error.code
  }

  return undefined
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function isTimeoutLikeError(error: unknown) {
  const code = getErrorCode(error)
  const message = getErrorMessage(error).toLowerCase()

  return (
    code === "ETIMEDOUT" ||
    code === "PROTOCOL_SEQUENCE_TIMEOUT" ||
    message.includes("timed out") ||
    message.includes("timeout")
  )
}

function isConnectionLikeError(error: unknown) {
  const code = getErrorCode(error)
  const message = getErrorMessage(error).toLowerCase()

  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "EHOSTUNREACH" ||
    code === "ECONNRESET" ||
    message.includes("connect") ||
    message.includes("connection")
  )
}

function resolveErrorPayload(error: unknown) {
  if (error instanceof ZodError) {
    return {
      status: 400,
      payload: {
        code: "BAD_REQUEST",
        message: "요청 값이 올바르지 않습니다.",
        details: error.issues[0]?.message,
      } satisfies ApiErrorPayload,
    }
  }

  if (error instanceof ReadOnlyTargetError) {
    return {
      status: 403,
      payload: {
        code: "READ_ONLY_TARGET",
        message: "PRODUCT 대상은 읽기 전용입니다.",
        details: `${error.target} target cannot be updated`,
      } satisfies ApiErrorPayload,
    }
  }

  if (isTimeoutLikeError(error)) {
    return {
      status: 503,
      payload: {
        code: "DB_TIMEOUT",
        message: "DB 연결 시간이 초과되었습니다.",
        hint: DB_TROUBLESHOOTING_HINT,
        details: getErrorMessage(error),
      } satisfies ApiErrorPayload,
    }
  }

  if (isConnectionLikeError(error)) {
    return {
      status: 503,
      payload: {
        code: "DB_CONNECTION_ERROR",
        message: "DB에 연결할 수 없습니다.",
        hint: DB_TROUBLESHOOTING_HINT,
        details: getErrorMessage(error),
      } satisfies ApiErrorPayload,
    }
  }

  return {
    status: 500,
    payload: {
      code: "INTERNAL_SERVER_ERROR",
      message: "서버 처리 중 오류가 발생했습니다.",
      details: getErrorMessage(error),
    } satisfies ApiErrorPayload,
  }
}

export function okResponse<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccess<T>>(
    {
      ok: true,
      data,
    },
    { status }
  )
}

export function notFoundResponse(message: string) {
  return NextResponse.json<ApiFailure>(
    {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message,
      },
    },
    { status: 404 }
  )
}

export function errorResponse(error: unknown) {
  const { status, payload } = resolveErrorPayload(error)

  return NextResponse.json<ApiFailure>(
    {
      ok: false,
      error: payload,
    },
    { status }
  )
}
