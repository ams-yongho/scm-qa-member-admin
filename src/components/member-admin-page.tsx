"use client"

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  AlertCircle,
  Beaker,
  Database,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react"
import { startTransition, useState } from "react"
import { toast } from "sonner"

import { BuyerDetailForm } from "@/components/buyer-detail-form"
import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ApiClientError, fetchApi } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import type { BuyerDetailData, BuyerSearchData, DatabaseHealthData } from "@/types/api"
import type { BuyerSearchField, BuyerStatus, UpdateBuyerInput } from "@/types/buyer"
import {
  serverTargetLabels,
  type ServerTarget,
} from "@/types/server-target"

const SEARCH_FIELD_OPTIONS: Array<{
  value: BuyerSearchField
  label: string
}> = [
  { value: "login_id", label: "로그인 ID" },
  { value: "email", label: "이메일" },
  { value: "phone_number", label: "휴대폰 번호" },
  { value: "id", label: "회원 ID" },
]

function getMockSearchPresets(target: ServerTarget) {
  if (target === "product") {
    return [
      { field: "login_id" as const, value: "prod-member-01", label: "prod-member-01" },
      { field: "email" as const, value: "admin@prod-biz.co.kr", label: "admin@prod-biz.co.kr" },
      { field: "id" as const, value: "9001", label: "9001" },
    ]
  }

  return [
    { field: "login_id" as const, value: "qa-member-01", label: "qa-member-01" },
    { field: "email" as const, value: "ops@techcorp.co.kr", label: "ops@techcorp.co.kr" },
    { field: "phone_number" as const, value: "01099887766", label: "01099887766" },
    { field: "id" as const, value: "101", label: "101" },
  ]
}

function getErrorCopy(error: unknown) {
  if (error instanceof ApiClientError) {
    return {
      title: error.message,
      description: error.hint ?? error.details,
    }
  }

  if (error instanceof Error) {
    return {
      title: error.message,
      description: undefined,
    }
  }

  return {
    title: "알 수 없는 오류가 발생했습니다.",
    description: undefined,
  }
}

function getStatusBadgeVariant(status: BuyerStatus) {
  if (status === "ACTIVE") {
    return "default"
  }

  if (status === "SUSPENDED" || status === "WITHDRAWN") {
    return "destructive"
  }

  return "secondary"
}

function formatNullable(value: string | number | null) {
  return value ?? "-"
}

export function MemberAdminPage({
  defaultTarget,
}: {
  defaultTarget: ServerTarget
}) {
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<ServerTarget>(defaultTarget)
  const [searchField, setSearchField] = useState<BuyerSearchField>("login_id")
  const [searchInput, setSearchInput] = useState("")
  const [submittedQuery, setSubmittedQuery] = useState("")
  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null)

  const healthQuery = useQuery({
    queryKey: ["db-health", target],
    queryFn: () =>
      fetchApi<DatabaseHealthData>(`/api/health/db?target=${target}`),
  })

  const searchQuery = useQuery({
    queryKey: ["buyers", "search", target, searchField, submittedQuery],
    queryFn: () =>
      fetchApi<BuyerSearchData>(
        `/api/buyers/search?target=${target}&field=${searchField}&q=${encodeURIComponent(
          submittedQuery
        )}&limit=20`
      ),
    enabled: submittedQuery.length > 0,
  })

  const detailQuery = useQuery({
    queryKey: ["buyers", "detail", target, selectedBuyerId],
    queryFn: () =>
      fetchApi<BuyerDetailData>(
        `/api/buyers/${selectedBuyerId}?target=${target}`
      ),
    enabled: selectedBuyerId !== null,
  })

  const updateMutation = useMutation({
    mutationFn: (input: UpdateBuyerInput) =>
      fetchApi<BuyerDetailData>(`/api/buyers/${selectedBuyerId}?target=${target}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: async ({ item }) => {
      toast.success("회원 정보가 저장되었습니다.", {
        description: `${formatNullable(item.loginId)} / ${item.id}`,
      })

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["buyers", "search", target],
        }),
        queryClient.invalidateQueries({
          queryKey: ["buyers", "detail", target, item.id],
        }),
      ])
    },
    onError: (error) => {
      const message = getErrorCopy(error)
      toast.error(message.title, {
        description: message.description,
      })
    },
  })

  const healthError =
    healthQuery.isError && healthQuery.error ? getErrorCopy(healthQuery.error) : null
  const searchError =
    searchQuery.isError && searchQuery.error ? getErrorCopy(searchQuery.error) : null
  const detailError =
    detailQuery.isError && detailQuery.error ? getErrorCopy(detailQuery.error) : null
  const isMockData = healthQuery.data?.dataSource === "mock"
  const mockSearchPresets = getMockSearchPresets(target)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Card className="overflow-visible border-none bg-transparent py-0 ring-0">
        <CardHeader className="rounded-[28px] border border-border/70 bg-card/80 py-6 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.9)] backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-amber-400 text-slate-900 hover:bg-amber-300">
                  QA ONLY
                </Badge>
                <Badge variant="outline">release는 staging DB를 사용합니다</Badge>
                {isMockData ? (
                  <Badge variant="secondary">
                    <Beaker className="mr-1 size-3" />
                    MOCK DATA
                  </Badge>
                ) : null}
                {target === "product" ? (
                  <Badge variant="destructive">PRODUCT 읽기 전용</Badge>
                ) : null}
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl font-semibold sm:text-3xl">
                  SCM 회원 QA 관리 도구
                </CardTitle>
                <CardDescription className="max-w-2xl text-sm leading-6">
                  Next.js 서버에서만 MySQL에 연결합니다. 검색 대상은
                  `partsfit_mall_buyer` 이고, 비밀번호는 조회/수정 범위에서
                  제외됩니다.
                </CardDescription>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[220px_auto_auto]">
              <Select
                value={target}
                onValueChange={(value) =>
                  startTransition(() => {
                    setTarget(value as ServerTarget)
                    setSelectedBuyerId(null)
                  })
                }
              >
                <SelectTrigger className="h-10 w-full rounded-full bg-background/80 px-4">
                  <SelectValue placeholder="서버 선택" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(serverTargetLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full px-4"
                onClick={() => healthQuery.refetch()}
              >
                <RefreshCw className="size-4" />
                연결 점검
              </Button>

              <div className="flex items-center justify-end gap-2">
                <ThemeToggle />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-2">
              <Database className="size-4 text-muted-foreground" />
              <span className="font-medium">대상</span>
              <span className="font-mono">{serverTargetLabels[target]}</span>
              <span className="text-muted-foreground">
                →{" "}
                {healthQuery.data?.resolvedTarget.toUpperCase() ??
                  (target === "product" ? "PRODUCT" : "STAGING")}
              </span>
            </div>

            <Badge
              variant={
                healthQuery.isSuccess
                  ? "default"
                  : healthQuery.isError
                    ? "destructive"
                    : "secondary"
              }
            >
              {healthQuery.isPending
                ? "DB 확인 중"
                : healthQuery.isSuccess && healthQuery.data.dataSource === "mock"
                  ? "Mock 데이터 사용 중"
                  : healthQuery.isSuccess
                  ? `${healthQuery.data.resolvedTarget.toUpperCase()} 연결됨`
                  : "DB 연결 실패"}
            </Badge>

            {healthQuery.data ? (
              <span className="font-mono text-xs text-muted-foreground">
                {healthQuery.data.serverTime} / {healthQuery.data.latencyMs}ms
              </span>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      {healthError ? (
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>{healthError.title}</AlertTitle>
          <AlertDescription>
            {healthError.description ??
              "Azure MySQL 방화벽, VNet, 3306 outbound, TLS 설정을 확인하세요."}
          </AlertDescription>
        </Alert>
      ) : null}

      {isMockData ? (
        <Alert>
          <Beaker />
          <AlertTitle>Mock 데이터 모드</AlertTitle>
          <AlertDescription>
            현재는 더미 데이터로 조회/수정 플로우를 확인하는 단계입니다. 저장 결과는
            메모리에만 반영되며 서버 재시작 시 초기화됩니다.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
        <div className="space-y-6">
          <Card className="border border-border/70 bg-card/80 shadow-[0_18px_60px_-44px_rgba(15,23,42,0.9)] backdrop-blur">
            <CardHeader>
              <CardTitle>회원 검색</CardTitle>
              <CardDescription>
                `id / login_id / email / phone_number` 기준으로 최대 20건까지
                조회합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_auto]"
                onSubmit={(event) => {
                  event.preventDefault()

                  const nextQuery = searchInput.trim()
                  if (!nextQuery) {
                    toast.info("검색어를 입력하세요.")
                    return
                  }

                  setSelectedBuyerId(null)
                  setSubmittedQuery(nextQuery)
                }}
              >
                <Select
                  value={searchField}
                  onValueChange={(value) =>
                    setSearchField(value as BuyerSearchField)
                  }
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="검색 항목" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEARCH_FIELD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="h-10"
                  placeholder="예: test01 / qa@example.com / 01012341234"
                />

                <Button type="submit" className="h-10 rounded-full px-5">
                  <Search className="size-4" />
                  검색
                </Button>
              </form>

              {isMockData ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    샘플 검색:
                  </span>
                  {mockSearchPresets.map((preset) => (
                    <Button
                      key={`${preset.field}:${preset.value}`}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSearchField(preset.field)
                        setSearchInput(preset.value)
                        setSubmittedQuery(preset.value)
                        setSelectedBuyerId(null)
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-card/80 shadow-[0_18px_60px_-44px_rgba(15,23,42,0.9)] backdrop-blur">
            <CardHeader>
              <CardTitle>검색 결과</CardTitle>
              <CardDescription>
                행을 클릭하면 상세 수정 폼이 열립니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {searchError ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>{searchError.title}</AlertTitle>
                  <AlertDescription>{searchError.description}</AlertDescription>
                </Alert>
              ) : null}

              {submittedQuery.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                  검색어를 입력하고 회원을 조회하세요.
                </div>
              ) : searchQuery.isPending ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ) : searchQuery.data?.items.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>로그인 ID</TableHead>
                      <TableHead>이름</TableHead>
                      <TableHead>휴대폰</TableHead>
                      <TableHead>이메일</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>수정일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchQuery.data.items.map((buyer) => (
                      <TableRow
                        key={buyer.id}
                        className={cn(
                          "cursor-pointer",
                          selectedBuyerId === buyer.id && "bg-muted/60"
                        )}
                        onClick={() => setSelectedBuyerId(buyer.id)}
                      >
                        <TableCell className="font-mono">{buyer.id}</TableCell>
                        <TableCell className="font-mono">
                          {formatNullable(buyer.loginId)}
                        </TableCell>
                        <TableCell>{formatNullable(buyer.name)}</TableCell>
                        <TableCell className="font-mono">
                          {formatNullable(buyer.phoneNumber)}
                        </TableCell>
                        <TableCell>{formatNullable(buyer.email)}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(buyer.status)}>
                            {buyer.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {buyer.updatedAt}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                  조회된 회원이 없습니다.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border border-border/70 bg-card/80 shadow-[0_18px_60px_-44px_rgba(15,23,42,0.9)] backdrop-blur">
          <CardHeader>
            <CardTitle>회원 상세</CardTitle>
            <CardDescription>
              현재 선택된 서버에서 회원을 조회하고 수정합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {target === "product" ? (
              <Alert>
                <ShieldAlert />
                <AlertTitle>PRODUCT 저장 차단</AlertTitle>
                <AlertDescription>
                  product 대상은 조회만 가능하며 저장 API는 403으로 차단됩니다.
                </AlertDescription>
              </Alert>
            ) : null}

            {detailError ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>{detailError.title}</AlertTitle>
                <AlertDescription>{detailError.description}</AlertDescription>
              </Alert>
            ) : null}

            {selectedBuyerId === null ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-5 py-12 text-center">
                <p className="text-sm font-medium">선택된 회원이 없습니다.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  왼쪽 검색 결과에서 회원 행을 선택하세요.
                </p>
              </div>
            ) : detailQuery.isPending ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
              </div>
            ) : detailQuery.data?.item ? (
              <BuyerDetailForm
                buyer={detailQuery.data.item}
                isReadOnly={target === "product"}
                isSaving={updateMutation.isPending}
                onSubmit={(input) => updateMutation.mutate(input)}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-5 py-12 text-center text-sm text-muted-foreground">
                선택한 회원을 불러오지 못했습니다.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator className="opacity-60" />

      <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-3">
        <p>`staging / release` 는 같은 staging DB를 사용합니다.</p>
        <p>DB 연결은 브라우저가 아니라 Next.js 서버에서만 수행됩니다.</p>
        <p>
          현재 네트워크에서 3306 timeout 이 발생하면 Azure MySQL 방화벽/VNet을
          우선 확인해야 합니다.
        </p>
      </div>
    </div>
  )
}
