"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuditQuery, type AuditLogItem } from "@/lib/queries/audit";
import { AuditDetailSheet } from "./_components/audit-detail-sheet";

const PAGE_SIZE = 50;

export default function AuditPage() {
  const [operatorInput, setOperatorInput] = React.useState("");
  const [buyerIdInput, setBuyerIdInput] = React.useState("");
  const [filters, setFilters] = React.useState<{
    operator?: string;
    buyerId?: number;
  }>({});
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<AuditLogItem | null>(null);

  const query = useAuditQuery({ ...filters, page, size: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = buyerIdInput.trim() ? Number(buyerIdInput.trim()) : undefined;
    setFilters({
      operator: operatorInput.trim() || undefined,
      buyerId: id && Number.isInteger(id) ? id : undefined,
    });
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">감사 로그</h1>
        <p className="text-sm text-muted-foreground">
          모든 회원 변경/삭제 작업의 기록입니다.
        </p>
      </header>

      <form onSubmit={submit} className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={operatorInput}
            onChange={(e) => setOperatorInput(e.target.value)}
            placeholder="operator 이름"
            className="pl-8 w-56"
          />
        </div>
        <Input
          value={buyerIdInput}
          onChange={(e) => setBuyerIdInput(e.target.value)}
          placeholder="buyer id"
          className="w-32"
          type="number"
          min={1}
        />
        <Button type="submit" variant="secondary">
          필터
        </Button>
      </form>

      {query.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(query.error as Error).message}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">시각</TableHead>
              <TableHead className="w-32">operator</TableHead>
              <TableHead className="w-32">action</TableHead>
              <TableHead className="w-24">buyer id</TableHead>
              <TableHead>buyer login_id</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  불러오는 중…
                </TableCell>
              </TableRow>
            ) : (query.data?.items ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  기록 없음
                </TableCell>
              </TableRow>
            ) : (
              query.data!.items.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(row)}
                >
                  <TableCell className="text-xs">
                    {new Date(row.createdAt).toLocaleString("ko-KR")}
                  </TableCell>
                  <TableCell>{row.operator}</TableCell>
                  <TableCell>
                    <Badge
                      variant={row.action === "buyer.delete" ? "destructive" : "secondary"}
                    >
                      {row.action}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.buyerId}</TableCell>
                  <TableCell className="font-mono text-xs">{row.buyerLoginId}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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

      <AuditDetailSheet
        item={selected}
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      />
    </div>
  );
}
