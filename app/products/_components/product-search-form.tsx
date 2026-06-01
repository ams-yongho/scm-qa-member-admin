"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Props {
  onSearch: (q: string, includeDeleted: boolean) => void;
}

export function ProductSearchForm({ onSearch }: Props) {
  const [q, setQ] = React.useState("");
  const [includeDeleted, setIncludeDeleted] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(q.trim(), includeDeleted);
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-3">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="몰코드 / 상품명 / 품번 / ID (2글자 이상)"
          className="pl-8"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch id="incl-del" checked={includeDeleted} onCheckedChange={setIncludeDeleted} />
        <Label htmlFor="incl-del" className="text-sm text-muted-foreground">
          삭제재고 포함
        </Label>
      </div>
      <Button type="submit" variant="secondary">
        검색
      </Button>
    </form>
  );
}
