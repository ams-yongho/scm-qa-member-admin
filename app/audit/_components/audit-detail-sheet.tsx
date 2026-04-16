"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { AuditLogItem } from "@/lib/queries/audit";

interface Props {
  item: AuditLogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function tryParse(json: string | null) {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

function diff(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  if (!before) return [];
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  const out: { key: string; before: unknown; after: unknown }[] = [];
  for (const k of keys) {
    const b = before?.[k];
    const a = after?.[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      out.push({ key: k, before: b, after: a });
    }
  }
  return out;
}

export function AuditDetailSheet({ item, open, onOpenChange }: Props) {
  const before = item ? tryParse(item.before) : null;
  const after = item ? tryParse(item.after) : null;
  const isDelete = item?.action === "buyer.delete";
  const changes = diff(
    before as Record<string, unknown> | null,
    (after ?? null) as Record<string, unknown> | null,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full p-0">
        {!item ? null : (
          <div className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span>#{item.id}</span>
                <Badge variant={isDelete ? "destructive" : "secondary"}>
                  {item.action}
                </Badge>
              </SheetTitle>
              <SheetDescription>
                {new Date(item.createdAt).toLocaleString("ko-KR")} · {item.operator}{" "}
                · buyer #{item.buyerId} ({item.buyerLoginId})
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {isDelete ? (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">삭제된 회원 스냅샷</h4>
                  <pre className="rounded-md border bg-muted/40 p-3 text-xs overflow-auto">
                    {JSON.stringify(before, null, 2)}
                  </pre>
                </div>
              ) : (
                <>
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">변경 내역</h4>
                    {changes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">변경 사항 없음</p>
                    ) : (
                      <table className="w-full text-xs border">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="text-left p-2 font-medium">필드</th>
                            <th className="text-left p-2 font-medium text-destructive">
                              before
                            </th>
                            <th className="text-left p-2 font-medium text-emerald-600">
                              after
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {changes.map((c) => (
                            <tr key={c.key} className="border-t">
                              <td className="p-2 font-mono">{c.key}</td>
                              <td className="p-2 font-mono text-destructive">
                                {JSON.stringify(c.before)}
                              </td>
                              <td className="p-2 font-mono text-emerald-600">
                                {JSON.stringify(c.after)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      전체 스냅샷 보기
                    </summary>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <pre className="rounded-md border bg-muted/40 p-3 overflow-auto">
                        {JSON.stringify(before, null, 2)}
                      </pre>
                      <pre className="rounded-md border bg-muted/40 p-3 overflow-auto">
                        {JSON.stringify(after, null, 2)}
                      </pre>
                    </div>
                  </details>
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
