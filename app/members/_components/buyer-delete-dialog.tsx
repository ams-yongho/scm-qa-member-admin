"use client";

import * as React from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeleteBuyerMutation, type BuyerDetail } from "@/lib/queries/buyers";

interface BuyerDeleteDialogProps {
  buyer: BuyerDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function BuyerDeleteDialog({
  buyer,
  open,
  onOpenChange,
  onDeleted,
}: BuyerDeleteDialogProps) {
  const [confirmText, setConfirmText] = React.useState("");
  const mutation = useDeleteBuyerMutation(buyer.id);

  React.useEffect(() => {
    if (!open) setConfirmText("");
  }, [open]);

  const expected = buyer.login_id ?? "";
  const matches = expected.length > 0 && confirmText === expected;

  const handleDelete = async () => {
    try {
      const res = await mutation.mutateAsync(confirmText);
      if (res.auditFailed) {
        toast.warning("회원은 삭제됐지만 감사 로그 기록에 실패했습니다.");
      } else {
        toast.success(`회원 #${buyer.id} 삭제됨`);
      }
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  const counts = buyer._count;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>회원 삭제</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                <span className="font-semibold text-foreground">{expected}</span> (#{buyer.id}) 회원을
                영구 삭제합니다. 이 작업은 되돌릴 수 없습니다.
              </p>
              <ul className="rounded-md border bg-muted/40 p-3 text-xs">
                <li>OAuth 연결 {counts.partsfit_mall_buyer_oauth}건이 함께 삭제됩니다.</li>
                <li>주소 {counts.partsfit_mall_buyer_address}건이 함께 삭제됩니다.</li>
                <li>차량 {counts.partsfit_mall_buyer_car}건이 함께 삭제됩니다.</li>
                <li>탈퇴 기록(buyer_withdraw)도 정리됩니다.</li>
              </ul>
              <div className="space-y-2">
                <Label htmlFor="confirm-input" className="text-foreground">
                  확인을 위해 <code className="rounded bg-muted px-1 font-mono">{expected}</code> 를
                  입력하세요.
                </Label>
                <Input
                  id="confirm-input"
                  autoComplete="off"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={expected}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            disabled={!matches || mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              if (matches) void handleDelete();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending ? "삭제 중…" : "영구 삭제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
