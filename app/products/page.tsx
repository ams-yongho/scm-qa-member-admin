"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useProductsQuery } from "@/lib/queries/products";
import { ProductSearchForm } from "./_components/product-search-form";
import { ProductTable } from "./_components/product-table";
import { ProductStatusSheet } from "./_components/product-status-sheet";

const PAGE_SIZE = 20;

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">불러오는 중…</div>}>
      <ProductsPageInner />
    </Suspense>
  );
}

function ProductsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedIdRaw = searchParams.get("id");
  const selectedId = selectedIdRaw ? Number(selectedIdRaw) : null;

  const [submittedQ, setSubmittedQ] = React.useState("");
  const [includeDeleted, setIncludeDeleted] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const query = useProductsQuery({
    q: submittedQ || undefined,
    includeDeleted,
    page,
    size: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));

  const updateSelected = (id: number | null) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (id == null) params.delete("id");
    else params.set("id", String(id));
    const qs = params.toString();
    router.replace(qs ? `/products?${qs}` : "/products");
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">상품 관리</h1>
        <p className="text-sm text-muted-foreground">
          partsfit_mall 상품 판매 상태 변경 (staging DB · 부수효과 없음)
        </p>
      </header>

      <ProductSearchForm
        onSearch={(q, incl) => {
          setSubmittedQ(q);
          setIncludeDeleted(incl);
          setPage(1);
        }}
      />

      {query.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(query.error as Error).message}
        </div>
      )}

      <ProductTable
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
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            이전
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            다음
          </Button>
        </div>
      </div>

      <ProductStatusSheet
        productId={selectedId}
        open={!!selectedId}
        onOpenChange={(o) => {
          if (!o) updateSelected(null);
        }}
      />
    </div>
  );
}
