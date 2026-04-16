"use client";

import { create } from "zustand";

const COOKIE_NAME = "operator";

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function writeCookie(value: string) {
  if (typeof document === "undefined") return;
  // 30 days, path=/
  const maxAge = 60 * 60 * 24 * 30;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

interface OperatorState {
  name: string | null;
  hydrated: boolean;
  hydrate: () => void;
  setName: (name: string) => void;
  clear: () => void;
}

export const useOperator = create<OperatorState>((set) => ({
  name: null,
  hydrated: false,
  hydrate: () => set({ name: readCookie(), hydrated: true }),
  setName: (name) => {
    writeCookie(name);
    set({ name });
  },
  clear: () => {
    writeCookie("");
    set({ name: null });
  },
}));
