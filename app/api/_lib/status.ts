export const PRODUCT_STATUS_VALUES = [
  "SALE",
  "STOP",
  "SOLD_OUT",
  "ONSITE",
  "READY",
  "EXAMINE",
  "REJECT",
] as const;

export type ProductStatus = (typeof PRODUCT_STATUS_VALUES)[number];

interface StatusMeta {
  label: string;
  /** Badge용 tailwind className */
  className: string;
}

const META: Record<ProductStatus, StatusMeta> = {
  SALE: { label: "판매중", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  STOP: { label: "판매중지", className: "bg-orange-100 text-orange-700 border-orange-200" },
  SOLD_OUT: { label: "품절", className: "bg-gray-100 text-gray-600 border-gray-200" },
  ONSITE: { label: "현장판매", className: "bg-blue-100 text-blue-700 border-blue-200" },
  READY: { label: "판매준비", className: "bg-sky-100 text-sky-700 border-sky-200" },
  EXAMINE: { label: "검토", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  REJECT: { label: "반려", className: "bg-red-100 text-red-700 border-red-200" },
};

const FALLBACK_CLASS = "bg-gray-100 text-gray-500 border-gray-200";

export const PRODUCT_STATUS_OPTIONS = PRODUCT_STATUS_VALUES.map((value) => ({
  value,
  label: META[value].label,
}));

/** 7종이 아닌 값(시스템 상태 등)도 표시 가능하도록 fallback 제공. */
export function getStatusMeta(status: string): StatusMeta {
  if ((PRODUCT_STATUS_VALUES as readonly string[]).includes(status)) {
    return META[status as ProductStatus];
  }
  return { label: status, className: FALLBACK_CLASS };
}
