"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, Strategy, CreateStrategyInput } from "@/lib/api";
import { toast } from "sonner";
import { AxiosError } from "axios";

export const strategyKeys = {
  all: ["strategies"] as const,
  lists: () => [...strategyKeys.all, "list"] as const,
  list: (page: number, pageSize: number) => [...strategyKeys.lists(), { page, pageSize }] as const,
  details: () => [...strategyKeys.all, "detail"] as const,
  detail: (id: number) => [...strategyKeys.details(), id] as const,
  types: () => [...strategyKeys.all, "types"] as const,
};

export function useStrategies(page = 1, pageSize = 10) {
  return useQuery({
    queryKey: strategyKeys.list(page, pageSize),
    queryFn: () => api.strategies.list(page, pageSize),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useStrategy(id: number) {
  return useQuery({
    queryKey: strategyKeys.detail(id),
    queryFn: () => api.strategies.get(id),
    enabled: !!id,
  });
}

export function useCreateStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStrategyInput) => api.strategies.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: strategyKeys.lists() });
      toast.success("전략이 생성되었습니다!");
    },
    onError: (error) => {
      console.error("Strategy creation error:", error);
      
      let description = "잠시 후 다시 시도해주세요.";
      
      if (error instanceof AxiosError) {
        const detail = error.response?.data?.detail;
        if (typeof detail === "string") {
          description = detail;
        } else if (Array.isArray(detail)) {
          // Validation errors
          const messages = detail.map((d: { msg?: string }) => d.msg).filter(Boolean);
          if (messages.length > 0) {
            description = messages.join(", ");
          }
        }
        
        if (error.response?.status === 401) {
          description = "로그인이 필요합니다.";
        } else if (error.response?.status === 422) {
          description = "입력값을 확인해주세요. " + description;
        }
      }
      
      toast.error("전략 생성 실패", { description });
    },
  });
}

export function useUpdateStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateStrategyInput> }) =>
      api.strategies.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: strategyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: strategyKeys.detail(variables.id) });
      toast.success("전략이 수정되었습니다!");
    },
    onError: () => {
      toast.error("전략 수정 실패", {
        description: "잠시 후 다시 시도해주세요.",
      });
    },
  });
}

export function useDeleteStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.strategies.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: strategyKeys.lists() });
      toast.success("전략이 삭제되었습니다!");
    },
    onError: () => {
      toast.error("전략 삭제 실패", {
        description: "잠시 후 다시 시도해주세요.",
      });
    },
  });
}

