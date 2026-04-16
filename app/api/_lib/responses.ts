import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: "BAD_REQUEST", message, details }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: "NOT_FOUND", message }, { status: 404 });
}

export function preconditionFailed(message: string) {
  return NextResponse.json({ error: "PRECONDITION_FAILED", message }, { status: 412 });
}

export function forbidden(message: string) {
  return NextResponse.json({ error: "FORBIDDEN", message }, { status: 403 });
}

export function serverError(message: string, details?: unknown) {
  return NextResponse.json({ error: "INTERNAL", message, details }, { status: 500 });
}

export function fromZodError(err: ZodError) {
  return badRequest("Validation failed", err.flatten());
}
