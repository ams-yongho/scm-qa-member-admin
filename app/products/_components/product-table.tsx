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
import { cn } from "@/lib/utils";
import { getStatusMeta } from "@/app/api/_lib/status";
import type { ProductListItem } from "@/lib/queries/products";

interface ProductTableProps {
  data: ProductListItem[];
  loading?: boolean;
  selectedId?: number | null;
  onSelect: (id: number) => void;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">-</span>;
  const meta = getStatusMeta(status);
  return <Badge variant="outline" className={cn("font-medium", meta.className)}>{meta.label}</Badge>;
}

const columns: ColumnDef<ProductListItem>[] = [
  { accessorKey: "id", header: "ID", size: 80 },
  { accessorKey: "mall_product_code", header: "몰코드" },
  { accessorKey: "product_name", header: "상품명" },
  { accessorKey: "part_number", header: "품번" },
  {
    accessorKey: "status",
    header: "판매상태",
    cell: ({ getValue }) => <StatusBadge status={getValue<string | null>()} />,
  },
  {
    accessorKey: "sales_status",
    header: "원장상태",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      return v ? (
        <span className="text-xs text-muted-foreground">{v}</span>
      ) : null;
    },
  },
  { accessorKey: "quantity", header: "수량", size: 70 },
];

export function ProductTable({ data, loading, selectedId, onSelect }: ProductTableProps) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

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
                결과 없음 (검색어 2글자 이상)
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
