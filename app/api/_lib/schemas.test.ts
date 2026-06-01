import { describe, it, expect } from "vitest";
import { productStatusUpdateSchema, productListQuerySchema } from "./schemas";

describe("productStatusUpdateSchema", () => {
  it("허용된 상태를 통과시킨다", () => {
    expect(productStatusUpdateSchema.safeParse({ status: "STOP" }).success).toBe(true);
  });
  it("7종 외 상태는 거부한다", () => {
    expect(productStatusUpdateSchema.safeParse({ status: "RELEASE_COMPLETED" }).success).toBe(false);
  });
  it("알 수 없는 키는 strict로 거부한다", () => {
    expect(
      productStatusUpdateSchema.safeParse({ status: "SALE", foo: 1 }).success,
    ).toBe(false);
  });
});

describe("productListQuerySchema", () => {
  it("1글자 검색어는 거부한다", () => {
    expect(productListQuerySchema.safeParse({ q: "a" }).success).toBe(false);
  });
  it("기본 page/size를 채운다", () => {
    const r = productListQuerySchema.parse({ q: "abc" });
    expect(r.page).toBe(1);
    expect(r.size).toBe(20);
    expect(r.includeDeleted).toBe(false);
  });
});
