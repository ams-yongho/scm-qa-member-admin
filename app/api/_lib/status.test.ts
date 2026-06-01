import { describe, it, expect } from "vitest";
import {
  PRODUCT_STATUS_VALUES,
  PRODUCT_STATUS_OPTIONS,
  getStatusMeta,
} from "./status";

describe("product status 상수", () => {
  it("QA 노출 7종을 정의한다", () => {
    expect(PRODUCT_STATUS_VALUES).toEqual([
      "SALE",
      "STOP",
      "SOLD_OUT",
      "ONSITE",
      "READY",
      "EXAMINE",
      "REJECT",
    ]);
  });

  it("모든 값에 한글 라벨과 className이 있다", () => {
    for (const v of PRODUCT_STATUS_VALUES) {
      const meta = getStatusMeta(v);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.className.length).toBeGreaterThan(0);
    }
    expect(getStatusMeta("SALE").label).toBe("판매중");
    expect(getStatusMeta("STOP").label).toBe("판매중지");
  });

  it("옵션 배열은 value/label 쌍 7개", () => {
    expect(PRODUCT_STATUS_OPTIONS).toHaveLength(7);
    expect(PRODUCT_STATUS_OPTIONS[0]).toEqual({ value: "SALE", label: "판매중" });
  });

  it("알 수 없는 상태는 회색 fallback 메타를 반환한다", () => {
    const meta = getStatusMeta("RELEASE_COMPLETED");
    expect(meta.label).toBe("RELEASE_COMPLETED");
    expect(meta.className).toContain("gray");
  });
});
