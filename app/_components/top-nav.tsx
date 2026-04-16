"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { OperatorPicker } from "./operator-picker";

const tabs = [
  { href: "/members", label: "회원 관리", icon: Users },
  { href: "/audit", label: "감사 로그", icon: ScrollText },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-6">
        <div className="mr-6 flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight">
            SCM QA · 회원 관리
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {tabs.map((tab) => {
            const active = pathname?.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <OperatorPicker />
        </div>
      </div>
    </header>
  );
}
