"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  useBuyerQuery,
  useUpdateBuyerMutation,
  type BuyerDetail,
} from "@/lib/queries/buyers";
import { BuyerDeleteDialog } from "./buyer-delete-dialog";

// Form schema: strings are kept (empty → null on submit), booleans/numbers strict.
const formSchema = z.object({
  name: z.string().max(50),
  email: z.string().max(255),
  phone_number: z.string().max(100),
  bank_name: z.string().max(100),
  bank_holder: z.string().max(100),
  bank_number: z.string().max(255),
  type: z.enum(["PERSONAL", "BUSINESS"]),
  car_unlimited: z.boolean(),
  max_car_limit: z.string(), // input type=number returns string
});

type FormValues = z.infer<typeof formSchema>;

interface BuyerEditSheetProps {
  buyerId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toForm(b: BuyerDetail): FormValues {
  return {
    name: b.name ?? "",
    email: b.email ?? "",
    phone_number: b.phone_number ?? "",
    bank_name: b.bank_name ?? "",
    bank_holder: b.bank_holder ?? "",
    bank_number: b.bank_number ?? "",
    type: (b.type === "BUSINESS" ? "BUSINESS" : "PERSONAL") as "PERSONAL" | "BUSINESS",
    car_unlimited: b.car_unlimited ?? false,
    max_car_limit: b.max_car_limit != null ? String(b.max_car_limit) : "",
  };
}

export function BuyerEditSheet({ buyerId, open, onOpenChange }: BuyerEditSheetProps) {
  const query = useBuyerQuery(buyerId);
  const buyer = query.data;
  const update = useUpdateBuyerMutation(buyerId ?? 0);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone_number: "",
      bank_name: "",
      bank_holder: "",
      bank_number: "",
      type: "PERSONAL",
      car_unlimited: false,
      max_car_limit: "",
    },
  });

  React.useEffect(() => {
    if (buyer) form.reset(toForm(buyer));
  }, [buyer, form]);

  const carUnlimited = form.watch("car_unlimited");

  const onSubmit = form.handleSubmit(async (values) => {
    if (!buyer) return;

    // Build patch — only include fields that changed from the buyer snapshot.
    const original = toForm(buyer);
    const patch: Record<string, unknown> = {};

    const stringFields: (keyof FormValues)[] = [
      "name",
      "email",
      "phone_number",
      "bank_name",
      "bank_holder",
      "bank_number",
    ];
    for (const key of stringFields) {
      if (values[key] !== original[key]) {
        patch[key] = values[key] === "" ? null : values[key];
      }
    }
    if (values.type !== original.type) patch.type = values.type;
    if (values.car_unlimited !== original.car_unlimited) {
      patch.car_unlimited = values.car_unlimited;
    }
    if (!values.car_unlimited && values.max_car_limit !== original.max_car_limit) {
      const n = values.max_car_limit === "" ? null : Number(values.max_car_limit);
      if (n !== null && (!Number.isInteger(n) || n < 0)) {
        toast.error("차량 한도는 0 이상 정수여야 합니다.");
        return;
      }
      patch.max_car_limit = n;
    }

    if (Object.keys(patch).length === 0) {
      toast.info("변경 사항이 없습니다.");
      return;
    }

    try {
      const res = await update.mutateAsync(patch);
      if (res.auditFailed) {
        toast.warning("저장은 됐지만 감사 로그 기록에 실패했습니다.");
      } else {
        toast.success("저장됨");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장 실패");
    }
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-xl w-full p-0">
          {!buyer ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {query.isLoading ? "불러오는 중…" : "회원을 선택하세요"}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex h-full flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span>{buyer.login_id ?? "(no login_id)"}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    #{buyer.id}
                  </span>
                </SheetTitle>
                <SheetDescription>
                  가입{" "}
                  {buyer.created_at
                    ? new Date(buyer.created_at).toLocaleString("ko-KR")
                    : "-"}
                </SheetDescription>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {buyer.type && (
                    <Badge variant={buyer.type === "BUSINESS" ? "secondary" : "outline"}>
                      {buyer.type}
                    </Badge>
                  )}
                  {buyer.status && <Badge variant="outline">status: {buyer.status}</Badge>}
                  {buyer.partsfit_mall_buyer_oauth.map((o, i) => (
                    <Badge key={i} variant="outline">
                      {o.provider}
                    </Badge>
                  ))}
                  <Badge variant="outline">
                    주소 {buyer._count.partsfit_mall_buyer_address}
                  </Badge>
                  <Badge variant="outline">
                    차량 {buyer._count.partsfit_mall_buyer_car}
                  </Badge>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {/* 개인정보 */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">개인정보</h3>
                  <Field label="이름">
                    <Input {...form.register("name")} />
                  </Field>
                  <Field label="이메일">
                    <Input type="email" {...form.register("email")} />
                  </Field>
                  <Field label="연락처">
                    <Input {...form.register("phone_number")} />
                  </Field>
                </section>

                <Separator />

                {/* 계좌 */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">계좌 정보</h3>
                  <Field label="은행명">
                    <Input {...form.register("bank_name")} />
                  </Field>
                  <Field label="예금주">
                    <Input {...form.register("bank_holder")} />
                  </Field>
                  <Field label="계좌번호">
                    <Input {...form.register("bank_number")} />
                  </Field>
                </section>

                <Separator />

                {/* 회원 구분 */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">회원 구분</h3>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={form.watch("type")}
                    onValueChange={(v) => {
                      if (v === "PERSONAL" || v === "BUSINESS") {
                        form.setValue("type", v, { shouldDirty: true });
                      }
                    }}
                  >
                    <ToggleGroupItem value="PERSONAL">PERSONAL</ToggleGroupItem>
                    <ToggleGroupItem value="BUSINESS">BUSINESS</ToggleGroupItem>
                  </ToggleGroup>
                </section>

                <Separator />

                {/* 차량 한도 */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">차량 등록 한도</h3>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={carUnlimited}
                      onCheckedChange={(v) =>
                        form.setValue("car_unlimited", v, { shouldDirty: true })
                      }
                      id="car_unlimited"
                    />
                    <Label htmlFor="car_unlimited" className="text-sm">
                      무제한 (car_unlimited)
                    </Label>
                  </div>
                  <Field label="최대 차량 수 (max_car_limit)">
                    <Input
                      type="number"
                      min={0}
                      disabled={carUnlimited}
                      {...form.register("max_car_limit")}
                    />
                  </Field>
                </section>

                <Separator />

                {/* Danger zone */}
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-destructive">위험 구역</h3>
                  <p className="text-xs text-muted-foreground">
                    이 회원과 연결된 OAuth/주소/차량 데이터가 함께 삭제됩니다.
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />이 회원 삭제…
                  </Button>
                </section>
              </div>

              <SheetFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  취소
                </Button>
                <Button type="submit" disabled={update.isPending || !form.formState.isDirty}>
                  {update.isPending ? "저장 중…" : "저장"}
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {buyer && (
        <BuyerDeleteDialog
          buyer={buyer}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={() => onOpenChange(false)}
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
