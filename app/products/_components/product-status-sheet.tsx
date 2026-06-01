"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  PRODUCT_STATUS_OPTIONS,
  getStatusMeta,
  type ProductStatus,
} from "@/app/api/_lib/status";
import {
  useProductQuery,
  useUpdateProductStatusMutation,
} from "@/lib/queries/products";

interface Props {
  productId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductStatusSheet({ productId, open, onOpenChange }: Props) {
  const query = useProductQuery(productId);
  const product = query.data;
  const update = useUpdateProductStatusMutation(productId ?? 0);

  const current = product?.product_partsfit?.status ?? null;
  const [next, setNext] = React.useState<ProductStatus | "">("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    setNext("");
  }, [productId]);

  const dirty = next !== "" && next !== current;

  const doUpdate = async () => {
    if (next === "" || !dirty) return;
    try {
      const { auditFailed } = await update.mutateAsync({ status: next });
      if (auditFailed) {
        toast.warning("상태는 변경됐지만 감사 로그 기록에 실패했습니다.");
      } else {
        toast.success("판매 상태를 변경했습니다.");
      }
      setConfirmOpen(false);
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg w-full">
          {!product ? (
            <div className="p-6 text-sm text-muted-foreground">불러오는 중…</div>
          ) : (
            <div className="flex h-full flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span>#{product.id}</span>
                  {current && (
                    <Badge variant="outline" className={cn(getStatusMeta(current).className)}>
                      {getStatusMeta(current).label}
                    </Badge>
                  )}
                </SheetTitle>
                <SheetDescription>
                  {product.product_partsfit?.product_name ?? "(상품명 없음)"}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto py-4 space-y-4 text-sm">
                <dl className="grid grid-cols-3 gap-y-2">
                  <dt className="text-muted-foreground">몰코드</dt>
                  <dd className="col-span-2 font-mono">{product.product_partsfit?.mall_product_code ?? "-"}</dd>
                  <dt className="text-muted-foreground">품번</dt>
                  <dd className="col-span-2 font-mono">{product.part_number ?? "-"}</dd>
                  <dt className="text-muted-foreground">원장상태</dt>
                  <dd className="col-span-2">{product.sales_status ?? "-"}</dd>
                  <dt className="text-muted-foreground">수량</dt>
                  <dd className="col-span-2">{product.product_partsfit?.quantity ?? "-"}</dd>
                </dl>

                <Separator />

                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 flex gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    이 변경은 sym DB의 판매 상태값만 바꿉니다. 쇼핑몰 게시(cafe24)·검색색인(ES)·재고
                    이벤트는 연동되지 않습니다.
                  </span>
                </div>

                <div className="space-y-2">
                  <Label>변경할 상태</Label>
                  <Select value={next} onValueChange={(v) => setNext(v as ProductStatus)}>
                    <SelectTrigger>
                      <SelectValue placeholder="상태 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} disabled={o.value === current}>
                          {o.label}
                          {o.value === current ? " (현재)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <SheetFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  취소
                </Button>
                <Button disabled={!dirty || update.isPending} onClick={() => setConfirmOpen(true)}>
                  상태 변경
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>판매 상태 변경</AlertDialogTitle>
            <AlertDialogDescription>
              {current ? getStatusMeta(current).label : "(없음)"} →{" "}
              {next ? getStatusMeta(next).label : ""} 로 변경합니다. 계속할까요?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={doUpdate}>변경</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
