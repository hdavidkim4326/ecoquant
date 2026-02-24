"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  BacktestStatusValue,
  normalizeBacktestStatus,
  RunBacktestInput,
} from "@/lib/api";
import { toast } from "sonner";
import { useState, useEffect, useCallback, useRef } from "react";

export const backtestKeys = {
  all: ["backtests"] as const,
  lists: () => [...backtestKeys.all, "list"] as const,
  list: (strategyId?: number, page?: number, pageSize?: number) =>
    [...backtestKeys.lists(), { strategyId, page, pageSize }] as const,
  details: () => [...backtestKeys.all, "detail"] as const,
  detail: (id: number) => [...backtestKeys.details(), id] as const,
  status: (backtestId: number) => [...backtestKeys.all, "status", backtestId] as const,
};

type UseBacktestsOptions = {
  refetchOnMount?: boolean;
  livePolling?: boolean;
};

export function useBacktests(
  strategyId?: number,
  page = 1,
  pageSize = 10,
  options: UseBacktestsOptions = {}
) {
  const { refetchOnMount = true, livePolling = false } = options;

  return useQuery({
    queryKey: backtestKeys.list(strategyId, page, pageSize),
    queryFn: () => api.backtests.list(strategyId, page, pageSize),
    staleTime: 30 * 1000,
    refetchOnMount,
    refetchInterval: (query) => {
      if (!livePolling) {
        return false;
      }

      const items = query.state.data?.items ?? [];
      const hasRunningBacktest = items.some((item) => {
        const status = normalizeBacktestStatus(item.status);
        return status === "pending" || status === "running";
      });

      return hasRunningBacktest ? 1500 : false;
    },
  });
}

export function useBacktest(id: number) {
  return useQuery({
    queryKey: backtestKeys.detail(id),
    queryFn: () => api.backtests.get(id),
    enabled: !!id && id > 0,
  });
}

export function useBacktestStatus(backtestId: number | null, enabled = true) {
  return useQuery({
    queryKey: backtestKeys.status(backtestId || 0),
    queryFn: () => api.backtests.status(backtestId!),
    enabled: !!backtestId && enabled,
    refetchInterval: (query) => {
      const status = normalizeBacktestStatus(query.state.data?.status);
      if (status === "completed" || status === "failed" || status === "cancelled") {
        return false;
      }
      return 1000;
    },
  });
}

export function useRunBacktest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RunBacktestInput) => api.backtests.run(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backtestKeys.lists() });
      queryClient.refetchQueries({ queryKey: backtestKeys.lists(), type: "active" });
    },
    onError: () => {
      toast.error("백테스트 실행 실패");
    },
  });
}

export function useBacktestWithPolling() {
  const [backtestId, setBacktestId] = useState<number | null>(null);
  const completedStateRef = useRef<BacktestStatusValue | null>(null);

  const runMutation = useRunBacktest();
  const statusQuery = useBacktestStatus(backtestId, !!backtestId);
  const resultQuery = useBacktest(backtestId || 0);
  const refetchResult = resultQuery.refetch;
  const queryClient = useQueryClient();

  const finalStatus = normalizeBacktestStatus(
    statusQuery.data?.status || resultQuery.data?.status
  ) as BacktestStatusValue;
  const isTerminalState =
    finalStatus === "completed" ||
    finalStatus === "failed" ||
    finalStatus === "cancelled";

  useEffect(() => {
    if (!backtestId) {
      completedStateRef.current = null;
      return;
    }

    if (!isTerminalState) {
      return;
    }

    if (completedStateRef.current === finalStatus) {
      return;
    }
    completedStateRef.current = finalStatus;

    queryClient.invalidateQueries({ queryKey: backtestKeys.lists() });
    queryClient.refetchQueries({ queryKey: backtestKeys.lists(), type: "active" });

    queryClient.invalidateQueries({ queryKey: backtestKeys.detail(backtestId) });
    refetchResult();

    if (finalStatus === "completed") {
      toast.success("백테스트 완료!");
    } else if (finalStatus === "failed") {
      toast.error("백테스트 실패", { description: statusQuery.data?.message });
    }
  }, [backtestId, finalStatus, isTerminalState, queryClient, refetchResult, statusQuery.data?.message]);

  const runBacktest = useCallback(
    async (data: RunBacktestInput) => {
      completedStateRef.current = null;
      setBacktestId(null);
      const result = await runMutation.mutateAsync(data);
      setBacktestId(result.backtest_id);
      return result;
    },
    [runMutation]
  );

  const reset = useCallback(() => {
    completedStateRef.current = null;
    setBacktestId(null);
  }, []);

  return {
    runBacktest,
    reset,
    isRunning: runMutation.isPending || (!!backtestId && !isTerminalState),
    status: finalStatus,
    progress: statusQuery.data?.progress ?? (isTerminalState ? 100 : 0),
    message: statusQuery.data?.message,
    result: resultQuery.data,
    backtestId,
    isLoadingResult: resultQuery.isLoading,
  };
}
