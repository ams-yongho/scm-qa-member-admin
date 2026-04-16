"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http/api-client";
import type { BuyerUpdate } from "@/app/api/_lib/schemas";

export interface BuyerListItem {
  id: number;
  type: string | null;
  login_id: string | null;
  name: string | null;
  email: string | null;
  phone_number: string | null;
  status: string | null;
  created_at: string | null;
}

export interface BuyerListResponse {
  items: BuyerListItem[];
  total: number;
  page: number;
  size: number;
}

export interface BuyerCar {
  id: number;
  registration_type: string;
  owner: string | null;
  plate_number: string | null;
  vin_code: string | null;
  car_brand_id: number | null;
  car_model_id: number | null;
  car_year: string | null;
  created_at: string | null;
}

export interface BuyerDetail extends BuyerListItem {
  password: string | null;
  bank_name: string | null;
  bank_number: string | null;
  bank_holder: string | null;
  marketing_use: boolean | null;
  sms_use: boolean | null;
  email_use: boolean | null;
  car_unlimited: boolean | null;
  max_car_limit: number | null;
  updated_at: string | null;
  partsfit_mall_buyer_oauth: { provider: string }[];
  partsfit_mall_buyer_car: BuyerCar[];
  _count: {
    partsfit_mall_buyer_oauth: number;
    partsfit_mall_buyer_address: number;
    partsfit_mall_buyer_car: number;
  };
}

export interface BuyerListFilters {
  q?: string;
  type?: "PERSONAL" | "BUSINESS";
  page?: number;
  size?: number;
}

export const buyerKeys = {
  all: ["buyers"] as const,
  list: (filters: BuyerListFilters) => ["buyers", "list", filters] as const,
  detail: (id: number) => ["buyers", "detail", id] as const,
};

export function useBuyersQuery(filters: BuyerListFilters) {
  return useQuery({
    queryKey: buyerKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get<BuyerListResponse>("/buyers", { params: filters });
      return data;
    },
  });
}

export function useBuyerQuery(id: number | null) {
  return useQuery({
    queryKey: id ? buyerKeys.detail(id) : ["buyers", "detail", "none"],
    queryFn: async () => {
      const { data } = await api.get<BuyerDetail>(`/buyers/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useUpdateBuyerMutation(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: BuyerUpdate) => {
      const res = await api.patch(`/buyers/${id}`, body);
      return {
        data: res.data,
        auditFailed: res.headers["x-audit-failed"] === "true",
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: buyerKeys.all });
    },
  });
}

export function useSoftDeleteCarMutation(buyerId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (carId: number) => {
      const res = await api.delete(`/buyers/${buyerId}/cars/${carId}`);
      return {
        data: res.data,
        auditFailed: res.headers["x-audit-failed"] === "true",
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: buyerKeys.detail(buyerId) });
    },
  });
}

export function useDeleteBuyerMutation(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (confirmLoginId: string) => {
      const res = await api.delete(`/buyers/${id}`, { data: { confirmLoginId } });
      return {
        data: res.data,
        auditFailed: res.headers["x-audit-failed"] === "true",
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: buyerKeys.all });
    },
  });
}
