"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Calendar,
  Edit,
  LineChart,
  MoreHorizontal,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useStrategies, useDeleteStrategy } from "@/hooks/use-strategies";
import { Strategy } from "@/lib/api";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Strategy type icon mapping
const getStrategyIcon = (type: string) => {
  if (type?.includes("sentiment") || type?.includes("ai")) {
    return { icon: Bot, bg: "bg-purple-100 dark:bg-purple-900/30", color: "text-purple-600 dark:text-purple-400" };
  }
  if (type?.includes("ema")) {
    return { icon: LineChart, bg: "bg-cyan-100 dark:bg-cyan-900/30", color: "text-cyan-600 dark:text-cyan-400" };
  }
  return { icon: TrendingUp, bg: "bg-blue-100 dark:bg-blue-900/30", color: "text-blue-600 dark:text-blue-400" };
};

// Strategy type label mapping
const getStrategyTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    sma_crossover: "SMA 이동평균선",
    ema_crossover: "EMA 지수이동평균선",
    sentiment_sma: "AI 뉴스 심리 전략",
    sentiment_sma_aggressive: "공격적 AI 전략",
    sentiment_sma_conservative: "보수적 AI 전략",
  };
  return labels[type?.toLowerCase()] || type;
};

export default function StrategiesPage() {
  const router = useRouter();
  const { data: strategiesData, isLoading } = useStrategies(1, 50);
  const deleteStrategy = useDeleteStrategy();
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [strategyToDelete, setStrategyToDelete] = useState<Strategy | null>(null);

  const handleDeleteClick = (strategy: Strategy) => {
    setStrategyToDelete(strategy);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!strategyToDelete) return;
    
    try {
      await deleteStrategy.mutateAsync(strategyToDelete.id);
      toast.success("전략이 삭제되었습니다");
    } catch {
      // Error handled by mutation
    } finally {
      setDeleteDialogOpen(false);
      setStrategyToDelete(null);
    }
  };

  const strategies = strategiesData?.items || [];

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">전략 관리</h1>
            <p className="text-muted-foreground mt-1">
              내 투자 전략을 관리하고 새로운 전략을 만들어보세요
            </p>
          </div>
          <Link href="/dashboard/strategies/new">
            <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-2">
              <Plus className="h-4 w-4" />
              새 전략 만들기
            </Button>
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-3">
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">총 전략</p>
                <p className="text-3xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="h-9 w-12" /> : strategies.length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AI 전략</p>
                <p className="text-3xl font-bold text-foreground">
                  {isLoading ? (
                    <Skeleton className="h-9 w-12" />
                  ) : (
                    strategies.filter((s) => s.strategy_type?.toLowerCase().includes("sentiment")).length
                  )}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">기술적 분석 전략</p>
                <p className="text-3xl font-bold text-foreground">
                  {isLoading ? (
                    <Skeleton className="h-9 w-12" />
                  ) : (
                    strategies.filter(
                      (s) => !s.strategy_type?.toLowerCase().includes("sentiment")
                    ).length
                  )}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-cyan-100 dark:bg-cyan-900/30">
                <TrendingUp className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Strategy List */}
        <motion.div variants={itemVariants} className="card-elevated p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">내 전략 목록</h2>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : strategies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative mb-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-blue-500/20">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                아직 전략이 없습니다
              </h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                첫 번째 투자 전략을 만들어보세요.
                <br />
                AI 뉴스 분석 전략을 추천드립니다!
              </p>
              <Link href="/dashboard/strategies/new">
                <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-2">
                  <Plus className="h-4 w-4" />
                  첫 전략 만들기
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {strategies.map((strategy) => {
                const { icon: Icon, bg, color } = getStrategyIcon(strategy.strategy_type);
                const logicConfig = strategy.logic_config as Record<string, number | boolean | undefined>;
                
                return (
                  <div
                    key={strategy.id}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors group cursor-pointer"
                    onClick={() => router.push(`/dashboard/strategies/${strategy.id}`)}
                  >
                    <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl shrink-0", bg)}>
                      <Icon className={cn("h-7 w-7", color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate">
                          {strategy.name}
                        </h3>
                        {strategy.strategy_type?.toLowerCase().includes("sentiment") && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                            AI
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {getStrategyTypeLabel(strategy.strategy_type)}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Settings2 className="h-3 w-3" />
                          단기 {logicConfig?.fast_period || "-"}일 / 장기 {logicConfig?.slow_period || "-"}일
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(strategy.created_at), {
                            addSuffix: true,
                            locale: ko,
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/dashboard/strategies/${strategy.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          상세보기
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/dashboard/strategies/${strategy.id}/edit`)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            수정
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(strategy)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2">
          <Link href="/dashboard/strategies/new?type=sentiment_sma" className="block">
            <div className="card-elevated p-6 hover:shadow-medium transition-shadow cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <Bot className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">AI 뉴스 심리 전략</h3>
                  <p className="text-sm text-muted-foreground">
                    추천! 뉴스 감성 분석을 활용한 하이브리드 전략
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </Link>
          <Link href="/dashboard/strategies/new?type=sma_crossover" className="block">
            <div className="card-elevated p-6 hover:shadow-medium transition-shadow cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">SMA 이동평균선</h3>
                  <p className="text-sm text-muted-foreground">
                    골든/데드 크로스 기반 기술적 분석 전략
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </Link>
        </motion.div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>전략을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{strategyToDelete?.name}</span> 전략을 삭제합니다.
              <br />
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

