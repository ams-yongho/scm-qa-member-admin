"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { BuyerListItem } from "@/lib/queries/buyers";

interface BuyerTableProps {
  data: BuyerListItem[];
  loading?: boolean;
  selectedId?: number | null;
  onSelect: (id: number) => void;
}

const columns: ColumnDef<BuyerListItem>[] = [
  { accessorKey: "id", header: "ID", size: 70 },
  { accessorKey: "login_id", header: "로그인 ID" },
  { accessorKey: "name", header: "이름" },
  { accessorKey: "email", header: "이메일" },
  { accessorKey: "phone_number", header: "연락처" },
  {
    accessorKey: "type",
    header: "구분",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      if (!v) return <span className="text-muted-foreground">-</span>;
      return (
        <Badge variant={v === "BUSINESS" ? "secondary" : "outline"}>{v}</Badge>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: "가입일",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      if (!v) return null;
      return (
        <span className="text-xs text-muted-foreground">
          {new Date(v).toLocaleDateString("ko-KR")}
        </span>
      );
    },
  },
];

export function BuyerTable({ data, loading, selectedId, onSelect }: BuyerTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} style={{ width: h.column.getSize() || undefined }}>
                  {h.isPlaceholder
                    ? null
                    : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                불러오는 중…
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                결과 없음
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.original.id === selectedId ? "selected" : undefined}
                onClick={() => onSelect(row.original.id)}
                className="cursor-pointer"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
