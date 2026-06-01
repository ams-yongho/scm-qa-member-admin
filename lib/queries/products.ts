"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http/api-client";
import type { ProductStatusUpdate } from "@/app/api/_lib/schemas";

export interface ProductListItem {
  id: number;
  part_number: string | null;
  sales_status: string | null;
  thumbnail: string | null;
  mall_product_code: string | null;
  product_name: string | null;
  status: string | null;
  quantity: number | null;
  price: string | null;
}

export interface ProductListResponse {
  items: ProductListItem[];
  total: number;
  page: number;
  size: number;
}

export interface ProductPartsfitDetail {
  id: number;
  mall_product_code: string | null;
  product_name: string | null;
  status: string | null;
  quantity: number | null;
  price: string | null;
  display_at: string | null;
  selling_at: string | null;
  updated_at: string | null;
}

export interface ProductDetail {
  id: number;
  part_number: string | null;
  sales_status: string | null;
  scope: string | null;
  thumbnail: string | null;
  created_at: string | null;
  updated_at: string | null;
  product_partsfit: ProductPartsfitDetail | null;
}

export interface ProductListFilters {
  q?: string;
  includeDeleted?: boolean;
  page?: number;
  size?: number;
}

export const productKeys = {
  all: ["products"] as const,
  list: (filters: ProductListFilters) => ["products", "list", filters] as const,
  detail: (id: number) => ["products", "detail", id] as const,
};

export function useProductsQuery(filters: ProductListFilters) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get<ProductListResponse>("/products", { params: filters });
      return data;
    },
  });
}

export function useProductQuery(id: number | null) {
  return useQuery({
    queryKey: id ? productKeys.detail(id) : ["products", "detail", "none"],
    queryFn: async () => {
      const { data } = await api.get<ProductDetail>(`/products/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useUpdateProductStatusMutation(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ProductStatusUpdate) => {
      const res = await api.patch(`/products/${id}`, body);
      return {
        data: res.data,
        auditFailed: res.headers["x-audit-failed"] === "true",
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}
