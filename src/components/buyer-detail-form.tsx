"use client"

import { useEffect } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  buyerStatusValues,
  buyerTypeValues,
  type BuyerDetail,
  type BuyerStatus,
  type BuyerType,
  type UpdateBuyerInput,
} from "@/types/buyer"

const NULL_TYPE_VALUE = "__NULL__"

interface BuyerFormValues {
  type: BuyerType | typeof NULL_TYPE_VALUE
  name: string
  phoneNumber: string
  email: string
  bankName: string
  bankNumber: string
  bankHolder: string
  status: BuyerStatus
  marketingUse: boolean
  smsUse: boolean
  emailUse: boolean
  carUnlimited: boolean
  maxCarLimit: string
}

const EMPTY_FORM_VALUES: BuyerFormValues = {
  type: NULL_TYPE_VALUE,
  name: "",
  phoneNumber: "",
  email: "",
  bankName: "",
  bankNumber: "",
  bankHolder: "",
  status: "ACTIVE",
  marketingUse: false,
  smsUse: false,
  emailUse: false,
  carUnlimited: false,
  maxCarLimit: "",
}

function getInitialValues(buyer: BuyerDetail): BuyerFormValues {
  return {
    type: buyer.type ?? NULL_TYPE_VALUE,
    name: buyer.name ?? "",
    phoneNumber: buyer.phoneNumber ?? "",
    email: buyer.email ?? "",
    bankName: buyer.bankName ?? "",
    bankNumber: buyer.bankNumber ?? "",
    bankHolder: buyer.bankHolder ?? "",
    status: buyer.status,
    marketingUse: buyer.marketingUse,
    smsUse: buyer.smsUse,
    emailUse: buyer.emailUse,
    carUnlimited: buyer.carUnlimited,
    maxCarLimit: buyer.maxCarLimit?.toString() ?? "",
  }
}

function normalizeTextValue(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function formatMetaValue(value: string | number | null) {
  return value ?? "-"
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <Label htmlFor={htmlFor} className="flex items-center gap-1 text-xs">
      <span>{children}</span>
      {required ? <span className="text-destructive">*</span> : null}
    </Label>
  )
}

export function BuyerDetailForm({
  buyer,
  isReadOnly,
  isSaving,
  onSubmit,
}: {
  buyer: BuyerDetail
  isReadOnly: boolean
  isSaving: boolean
  onSubmit: (input: UpdateBuyerInput) => void
}) {
  const { control, handleSubmit, register, reset, setValue } =
    useForm<BuyerFormValues>({
      defaultValues: EMPTY_FORM_VALUES,
    })

  const carUnlimited = useWatch({
    control,
    name: "carUnlimited",
  })

  useEffect(() => {
    reset(getInitialValues(buyer))
  }, [buyer, reset])

  useEffect(() => {
    if (carUnlimited) {
      setValue("maxCarLimit", "")
    }
  }, [carUnlimited, setValue])

  return (
    <form
      className="space-y-6"
      onSubmit={handleSubmit((values) =>
        onSubmit({
          type: values.type === NULL_TYPE_VALUE ? null : values.type,
          name: normalizeTextValue(values.name),
          phoneNumber: normalizeTextValue(values.phoneNumber),
          email: normalizeTextValue(values.email),
          bankName: normalizeTextValue(values.bankName),
          bankNumber: normalizeTextValue(values.bankNumber),
          bankHolder: normalizeTextValue(values.bankHolder),
          status: values.status,
          marketingUse: values.marketingUse,
          smsUse: values.smsUse,
          emailUse: values.emailUse,
          carUnlimited: values.carUnlimited,
          maxCarLimit:
            values.carUnlimited || values.maxCarLimit.trim().length === 0
              ? null
              : Number(values.maxCarLimit),
        })
      )}
    >
      <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/30 p-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">회원 ID</p>
          <p className="font-mono text-sm">{buyer.id}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">로그인 ID</p>
          <p className="font-mono text-sm">{formatMetaValue(buyer.loginId)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">생성일</p>
          <p className="font-mono text-sm">{buyer.createdAt}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">수정일</p>
          <p className="font-mono text-sm">{buyer.updatedAt}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel required>회원 유형</FieldLabel>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) =>
                  field.onChange(value ?? NULL_TYPE_VALUE)
                }
                disabled={isReadOnly || isSaving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="회원 유형 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NULL_TYPE_VALUE}>미지정</SelectItem>
                  {buyerTypeValues.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel required>상태</FieldLabel>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) =>
                  field.onChange((value ?? "ACTIVE") as BuyerStatus)
                }
                disabled={isReadOnly || isSaving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  {buyerStatusValues.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="buyer-name">이름</FieldLabel>
          <Input
            id="buyer-name"
            placeholder="회원 이름"
            disabled={isReadOnly || isSaving}
            {...register("name")}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="buyer-phone">휴대폰 번호</FieldLabel>
          <Input
            id="buyer-phone"
            placeholder="01012341234"
            disabled={isReadOnly || isSaving}
            {...register("phoneNumber")}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <FieldLabel htmlFor="buyer-email">이메일</FieldLabel>
          <Input
            id="buyer-email"
            type="email"
            placeholder="qa@example.com"
            disabled={isReadOnly || isSaving}
            {...register("email")}
          />
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <FieldLabel htmlFor="buyer-bank-name">은행명</FieldLabel>
          <Input
            id="buyer-bank-name"
            placeholder="은행명"
            disabled={isReadOnly || isSaving}
            {...register("bankName")}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="buyer-bank-number">계좌번호</FieldLabel>
          <Input
            id="buyer-bank-number"
            placeholder="123-456-789"
            disabled={isReadOnly || isSaving}
            {...register("bankNumber")}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="buyer-bank-holder">예금주</FieldLabel>
          <Input
            id="buyer-bank-holder"
            placeholder="예금주명"
            disabled={isReadOnly || isSaving}
            {...register("bankHolder")}
          />
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-background/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">마케팅 수신</p>
              <p className="text-xs text-muted-foreground">
                marketing_use / sms_use / email_use
              </p>
            </div>
            <Controller
              control={control}
              name="marketingUse"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isReadOnly || isSaving}
                />
              )}
            />
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">SMS 수신</Label>
              <Controller
                control={control}
                name="smsUse"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isReadOnly || isSaving}
                  />
                )}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">이메일 수신</Label>
              <Controller
                control={control}
                name="emailUse"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isReadOnly || isSaving}
                  />
                )}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">차량 등록 정책</p>
              <p className="text-xs text-muted-foreground">
                car_unlimited / max_car_limit
              </p>
            </div>
            <Controller
              control={control}
              name="carUnlimited"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isReadOnly || isSaving}
                />
              )}
            />
          </div>
          <div className="mt-4 space-y-2">
            <FieldLabel htmlFor="buyer-max-car-limit">최대 차량 수</FieldLabel>
            <Input
              id="buyer-max-car-limit"
              type="number"
              min="0"
              inputMode="numeric"
              disabled={isReadOnly || isSaving || carUnlimited}
              placeholder={carUnlimited ? "무제한" : "예: 3"}
              {...register("maxCarLimit")}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>
          비밀번호는 이번 화면에서 노출하거나 수정하지 않습니다. 빈 문자열은
          서버에서 `NULL` 로 정규화됩니다.
        </p>
        <Button type="submit" disabled={isReadOnly || isSaving}>
          {isSaving ? "저장 중..." : isReadOnly ? "PRODUCT 읽기 전용" : "변경 저장"}
        </Button>
      </div>
    </form>
  )
}
