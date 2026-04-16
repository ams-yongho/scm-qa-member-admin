"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useBuyersQuery } from "@/lib/queries/buyers";
import { BuyerTable } from "./_components/buyer-table";
import { BuyerEditSheet } from "./_components/buyer-edit-sheet";

const PAGE_SIZE = 20;
const ALL = "__all__";

export default function MembersPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">불러오는 중…</div>}>
      <MembersPageInner />
    </Suspense>
  );
}

function MembersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedIdRaw = searchParams.get("id");
  const selectedId = selectedIdRaw ? Number(selectedIdRaw) : null;

  const [q, setQ] = React.useState("");
  const [submittedQ, setSubmittedQ] = React.useState("");
  const [type, setType] = React.useState<"PERSONAL" | "BUSINESS" | "">("");
  const [page, setPage] = React.useState(1);

  const query = useBuyersQuery({
    q: submittedQ || undefined,
    type: type || undefined,
    page,
    size: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));

  const updateSelected = (id: number | null) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (id == null) params.delete("id");
    else params.set("id", String(id));
    const qs = params.toString();
    router.replace(qs ? `/members?${qs}` : "/members");
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedQ(q.trim());
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">회원 관리</h1>
          <p className="text-sm text-muted-foreground">
            partsfit_mall 회원 검색·수정·삭제 (staging DB)
          </p>
        </div>
      </header>

      <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="login_id / 이름 / 이메일 / 연락처"
            className="pl-8"
          />
        </div>
        <Select
          value={type === "" ? ALL : type}
          onValueChange={(v) => {
            setType(v === ALL ? "" : (v as "PERSONAL" | "BUSINESS"));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="전체 유형" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체 유형</SelectItem>
            <SelectItem value="PERSONAL">PERSONAL</SelectItem>
            <SelectItem value="BUSINESS">BUSINESS</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" variant="secondary">
          검색
        </Button>
      </form>

      {query.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(query.error as Error).message}
        </div>
      )}

      <BuyerTable
        data={query.data?.items ?? []}
        loading={query.isLoading}
        selectedId={selectedId}
        onSelect={updateSelected}
      />

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          총 {(query.data?.total ?? 0).toLocaleString()}건
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            이전
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </Button>
        </div>
      </div>

      <BuyerEditSheet
        buyerId={selectedId}
        open={!!selectedId}
        onOpenChange={(o) => {
          if (!o) updateSelected(null);
        }}
      />
    </div>
  );
}
