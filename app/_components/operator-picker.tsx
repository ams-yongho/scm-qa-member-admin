"use client";

import * as React from "react";
import { UserCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOperator } from "@/lib/store/operator";

export function OperatorPicker() {
  const { name, hydrated, hydrate, setName } = useOperator();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  React.useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  React.useEffect(() => {
    if (hydrated && !name) setOpen(true);
  }, [hydrated, name]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    setName(trimmed);
    setOpen(false);
    setDraft("");
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => {
          setDraft(name ?? "");
          setOpen(true);
        }}
      >
        <UserCircle2 className="h-4 w-4" />
        <span className="text-sm">{name ?? "이름 설정"}</span>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Forbid closing if no operator yet
          if (!next && !name) return;
          setOpen(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>오퍼레이터 이름 설정</DialogTitle>
            <DialogDescription>
              모든 변경 작업은 이 이름으로 감사 로그에 기록됩니다.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="operator-name">이름</Label>
              <Input
                id="operator-name"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="예: 김QA"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!draft.trim()}>
                저장
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
