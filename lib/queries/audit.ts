"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/http/api-client";

export interface AuditLogItem {
  id: number;
  createdAt: string;
  operator: string;
  action: string;
  buyerId: number;
  buyerLoginId: string;
  before: string;
  after: string | null;
}

export interface AuditListResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  size: number;
}

export interface AuditFilters {
  buyerId?: number;
  operator?: string;
  page?: number;
  size?: number;
}

export const auditKeys = {
  all: ["audit"] as const,
  list: (filters: AuditFilters) => ["audit", "list", filters] as const,
};

export function useAuditQuery(filters: AuditFilters) {
  return useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get<AuditListResponse>("/audit", { params: filters });
      return data;
    },
  });
}
