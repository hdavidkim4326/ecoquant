"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bot,
  ChevronRight,
  Clock,
  Edit,
  LineChart,
  Loader2,
  RefreshCcw,
  Search,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import { cn } from "@/lib/utils";
import { useStrategy, useDeleteStrategy } from "@/hooks/use-strategies";
import { useBacktestWithPolling } from "@/hooks/use-backtests";
import { api, LiveSignalResponse } from "@/lib/api";

// Loading messages
const loadingMessages = [
  "AI媛 ?쒖옣 ?곗씠?곕? 遺꾩꽍 以?..",
  "?대룞?됯퇏??怨꾩궛 以?..",
  "?댁뒪 媛먯꽦 ?먯닔 ?뺤씤 以?..",
  "理쒖쟻??留ㅻℓ ??대컢 遺꾩꽍 以?..",
];

// Popular tickers for quick selection
const popularTickers = ["AAPL", "TSLA", "NVDA", "MSFT", "GOOGL", "AMZN", "META"];

// Strategy type icon mapping
const getStrategyIcon = (type: string) => {
  if (type?.toLowerCase().includes("sentiment") || type?.toLowerCase().includes("ai")) {
    return { icon: Bot, bg: "bg-purple-100 dark:bg-purple-900/30", color: "text-purple-600 dark:text-purple-400" };
  }
  if (type?.toLowerCase().includes("ema")) {
    return { icon: LineChart, bg: "bg-cyan-100 dark:bg-cyan-900/30", color: "text-cyan-600 dark:text-cyan-400" };
  }
  return { icon: TrendingUp, bg: "bg-blue-100 dark:bg-blue-900/30", color: "text-blue-600 dark:text-blue-400" };
};

// Signal badge component
const SignalBadge = ({ signal, size = "md" }: { signal: string; size?: "sm" | "md" | "lg" }) => {
  const config = {
    BUY: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-600 dark:text-green-400", label: "留ㅼ닔" },
    SELL: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-500", label: "留ㅻ룄" },
    HOLD: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400", label: "관망" },
  }[signal] || { bg: "bg-muted", text: "text-muted-foreground", label: signal };

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-lg px-4 py-2 font-bold",
  }[size];

  return (
    <span className={cn("rounded-full font-medium", config.bg, config.text, sizeClasses)}>
      {config.label}
    </span>
  );
};

function hasDefinedNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined;
}

export default function StrategyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const strategyId = parseInt(params.id as string);

  const { data: strategy, isLoading: strategyLoading } = useStrategy(strategyId);
  const deleteStrategy = useDeleteStrategy();
  const backtestWithPolling = useBacktestWithPolling();

  // State
  const [isActive, setIsActive] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ticker, setTicker] = useState("AAPL");
  const [startDate, setStartDate] = useState("2023-01-01");
  const [endDate, setEndDate] = useState("2024-01-01");
  const [initialCapital, setInitialCapital] = useState("10000000");
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Live Signal State
  const [liveSignal, setLiveSignal] = useState<LiveSignalResponse | null>(null);
  const [liveSignalLoading, setLiveSignalLoading] = useState(false);
  const [liveSignalTicker, setLiveSignalTicker] = useState("AAPL");

  const logicConfig = strategy?.logic_config as Record<string, number | boolean | undefined> || {};
  const isAiStrategy = strategy?.strategy_type?.toLowerCase().includes("sentiment");
  const { icon: StrategyIcon, bg: iconBg, color: iconColor } = getStrategyIcon(strategy?.strategy_type || "");

  // Cycle loading messages
  useEffect(() => {
    if (backtestWithPolling.isRunning) {
      const interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [backtestWithPolling.isRunning]);

  // Auto-run initial backtest when strategy loads
  useEffect(() => {
    if (strategy && !backtestWithPolling.result && !backtestWithPolling.isRunning) {
      handleRunBacktest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy?.id]);

  // Generate chart data
  const chartData = useMemo(() => {
    const result = backtestWithPolling.result;
    if (result?.equity_curve && result.equity_curve.length > 0) {
      return result.equity_curve.map((point) => ({
        date: point.date,
        value: point.value,
        return: ((point.value - (result.initial_capital || 10000000)) / (result.initial_capital || 10000000)) * 100,
      }));
    }

    if (result?.status === "completed" && hasDefinedNumber(result?.total_return)) {
      const days = 252;
      const startValue = result.initial_capital || 10000000;
      const endValue = startValue * (1 + result.total_return / 100);
      const data = [];

      for (let i = 0; i <= days; i++) {
        const progress = i / days;
        const noise = (Math.random() - 0.5) * 0.02;
        const value = startValue + (endValue - startValue) * progress * (1 + noise);
        const date = new Date(result.start_date);
        date.setDate(date.getDate() + i);

        data.push({
          date: format(date, "yyyy-MM-dd"),
          value: Math.round(value),
          return: ((value - startValue) / startValue) * 100,
        });
      }
      return data;
    }
    return [];
  }, [backtestWithPolling.result]);

  const handleRunBacktest = async () => {
    if (!strategy) return;

    try {
      await backtestWithPolling.runBacktest({
        strategy_id: strategy.id,
        symbols: [ticker.toUpperCase()],
        start_date: startDate,
        end_date: endDate,
        initial_capital: parseInt(initialCapital),
      });
    } catch {
      // Error handled by hook
    }
  };

  const handleDelete = async () => {
    try {
      await deleteStrategy.mutateAsync(strategyId);
      toast.success("전략을 삭제했습니다.");
      router.push("/dashboard/strategies");
    } catch {
      // Error handled by mutation
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const handleFetchLiveSignal = async () => {
    if (!strategy) return;

    setLiveSignalLoading(true);
    try {
      const signal = await api.analysis.liveSignal(strategy.id, liveSignalTicker);
      setLiveSignal(signal);
    } catch (error) {
      console.error("Failed to fetch live signal:", error);
      toast.error("?ㅼ떆媛??좏샇 議고쉶 ?ㅽ뙣", {
        description: "?쒖옣 ?곗씠?곕? 媛?몄삤?????ㅽ뙣?덉뒿?덈떎.",
      });
    } finally {
      setLiveSignalLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const result = backtestWithPolling.result;
  const showResult = result?.status === "completed" && !backtestWithPolling.isRunning;
  const totalReturn = hasDefinedNumber(result?.total_return) ? result.total_return : undefined;
  const mdd = hasDefinedNumber(result?.mdd) ? result.mdd : undefined;
  const winRate = hasDefinedNumber(result?.win_rate) ? result.win_rate : undefined;
  const winningTrades = hasDefinedNumber(result?.winning_trades) ? result.winning_trades : undefined;
  const losingTrades = hasDefinedNumber(result?.losing_trades) ? result.losing_trades : undefined;
  const sharpeRatio = hasDefinedNumber(result?.sharpe_ratio) ? result.sharpe_ratio : undefined;
  const finalValue = hasDefinedNumber(result?.final_value) ? result.final_value : undefined;
  const totalTrades = hasDefinedNumber(result?.total_trades) ? result.total_trades : undefined;
  const profitFactor = hasDefinedNumber(result?.profit_factor) ? result.profit_factor : undefined;
  const sortinoRatio = hasDefinedNumber(result?.sortino_ratio) ? result.sortino_ratio : undefined;

  if (strategyLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[500px] rounded-2xl" />
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">?꾨왂??李얠쓣 ???놁뒿?덈떎</h2>
        <p className="text-muted-foreground mb-6">?붿껌?섏떊 ?꾨왂??議댁옱?섏? ?딄굅????젣?섏뿀?듬땲??</p>
        <Link href="/dashboard/strategies">
          <Button className="rounded-xl gap-2">
            <ArrowLeft className="h-4 w-4" />
            ?꾨왂 紐⑸줉?쇰줈 ?뚯븘媛湲?
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              onClick={() => router.back()}
              className="mt-1 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-4">
              <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl", iconBg)}>
                <StrategyIcon className={cn("h-8 w-8", iconColor)} />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-foreground">{strategy.name}</h1>
                  {isAiStrategy && (
                    <span className="px-2.5 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                      AI ?꾨왂
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground">{strategy.description || "?ㅻ챸 ?놁쓬"}</p>
              </div>
            </div>
          </div>

          {/* Status & Actions */}
          <div className="flex items-center gap-4 ml-14 lg:ml-0">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/50">
              <span className="text-sm text-muted-foreground">?곹깭:</span>
              <span className={cn(
                "font-medium",
                isActive ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
              )}>
                {isActive ? "가동 중" : "중지됨"}
              </span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <Link href={`/dashboard/strategies/${strategyId}/edit`}>
              <Button variant="outline" size="sm" className="rounded-lg gap-2">
                <Edit className="h-4 w-4" />
                ?섏젙
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              className="rounded-lg gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <Trash2 className="h-4 w-4" />
              ??젣
            </Button>
          </div>
        </div>

        {showResult &&
          result?.completed_at &&
          Date.now() - new Date(result.completed_at).getTime() <= 5 * 60 * 1000 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
            >
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                방금 완료된 백테스트 결과입니다. 대시보드에도 바로 반영됩니다.
              </p>
            </motion.div>
          )}

        {/* Section A: Key Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 md:grid-cols-4"
        >
          {/* Total Return */}
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">珥??섏씡瑜?(CAGR)</span>
              {totalReturn === undefined ? (
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              ) : totalReturn >= 0 ? (
                <ArrowUpRight className="h-5 w-5 text-green-500" />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-red-500" />
              )}
            </div>
            {showResult ? (
              <p className={cn(
                "text-3xl font-bold",
                totalReturn !== undefined && totalReturn >= 0
                  ? "text-green-600 dark:text-green-400"
                  : totalReturn !== undefined
                    ? "text-red-500"
                    : "text-muted-foreground"
              )}>
                {totalReturn !== undefined ? `${totalReturn > 0 ? "+" : ""}${totalReturn.toFixed(1)}%` : "-"}
              </p>
            ) : backtestWithPolling.isRunning ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <p className="text-3xl font-bold text-muted-foreground">-</p>
            )}
          </div>

          {/* MDD */}
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">理쒕? ?숉룺 (MDD)</span>
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
            {showResult ? (
              <p className="text-3xl font-bold text-red-500">
                {mdd !== undefined ? `${mdd.toFixed(1)}%` : "-"}
              </p>
            ) : backtestWithPolling.isRunning ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <p className="text-3xl font-bold text-muted-foreground">-</p>
            )}
          </div>

          {/* Win Rate */}
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">?밸쪧</span>
              <Target className="h-5 w-5 text-primary" />
            </div>
            {showResult ? (
              <>
                <p className="text-3xl font-bold text-primary">
                  {winRate !== undefined ? `${(winRate * 100).toFixed(0)}%` : "-"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {winningTrades ?? "-"}??/ {losingTrades ?? "-"}??
                </p>
              </>
            ) : backtestWithPolling.isRunning ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <p className="text-3xl font-bold text-muted-foreground">-</p>
            )}
          </div>

          {/* Sharpe Ratio */}
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">?ㅽ봽 鍮꾩쑉</span>
              <BarChart3 className="h-5 w-5 text-blue-500" />
            </div>
            {showResult ? (
              <p className="text-3xl font-bold text-foreground">
                {sharpeRatio !== undefined ? sharpeRatio.toFixed(2) : "-"}
              </p>
            ) : backtestWithPolling.isRunning ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <p className="text-3xl font-bold text-muted-foreground">-</p>
            )}
          </div>
        </motion.div>

        {/* Strategy Parameters Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-elevated p-6"
        >
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            ?꾨왂 ?뚮씪誘명꽣
          </h3>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <div className="p-3 rounded-xl bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">?④린 ?댄룊??</p>
              <p className="text-lg font-bold text-foreground">{logicConfig.fast_period || 10}??</p>
            </div>
            <div className="p-3 rounded-xl bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">?κ린 ?댄룊??</p>
              <p className="text-lg font-bold text-foreground">{logicConfig.slow_period || 30}??</p>
            </div>
            {isAiStrategy && (
              <>
                <div className="p-3 rounded-xl bg-secondary/50">
                  <p className="text-xs text-muted-foreground mb-1">留ㅼ닔 ?꾧퀎媛?</p>
                  <p className="text-lg font-bold text-green-600">{logicConfig.buy_threshold || 0.2}</p>
                </div>
                <div className="p-3 rounded-xl bg-secondary/50">
                  <p className="text-xs text-muted-foreground mb-1">?⑤땳? ?꾧퀎媛?</p>
                  <p className="text-lg font-bold text-red-500">{logicConfig.panic_threshold || -0.5}</p>
                </div>
              </>
            )}
            {(logicConfig.stop_loss as number) > 0 && (
              <div className="p-3 rounded-xl bg-secondary/50">
                <p className="text-xs text-muted-foreground mb-1">?먯젅媛</p>
                <p className="text-lg font-bold text-red-500">-{logicConfig.stop_loss}%</p>
              </div>
            )}
            {(logicConfig.take_profit as number) > 0 && (
              <div className="p-3 rounded-xl bg-secondary/50">
                <p className="text-xs text-muted-foreground mb-1">?듭젅媛</p>
                <p className="text-lg font-bold text-green-600">+{logicConfig.take_profit}%</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Section B: Universal Backtester */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-elevated p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                ?좊땲踰꾩뀥 諛깊뀒?ㅽ꽣
              </h3>
              <p className="text-sm text-muted-foreground">
                ???꾨왂???ㅻⅨ 醫낅ぉ?대굹 湲곌컙???뚯뒪?명빐蹂댁꽭??
              </p>
            </div>
            {showResult && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => backtestWithPolling.reset()}
                className="rounded-lg gap-2"
              >
                <RefreshCcw className="h-4 w-4" />
                珥덇린??
              </Button>
            )}
          </div>

          {/* Backtest Form */}
          <div className="grid gap-4 md:grid-cols-5 mb-6">
            <div>
              <Label className="text-sm mb-2 block">醫낅ぉ (Ticker)</Label>
              <Input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="AAPL"
                disabled={backtestWithPolling.isRunning}
                className="h-11 rounded-xl"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {popularTickers.slice(0, 4).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTicker(t)}
                    disabled={backtestWithPolling.isRunning}
                    className={cn(
                      "px-2 py-0.5 text-xs font-medium rounded-lg transition-colors",
                      ticker === t
                        ? "bg-primary text-white"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm mb-2 block">?쒖옉??</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={backtestWithPolling.isRunning}
                className="h-11 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-sm mb-2 block">醫낅즺??</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={backtestWithPolling.isRunning}
                className="h-11 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-sm mb-2 block">珥덇린 ?먮낯</Label>
              <Input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(e.target.value)}
                disabled={backtestWithPolling.isRunning}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleRunBacktest}
                disabled={backtestWithPolling.isRunning}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-xl gap-2"
              >
                {backtestWithPolling.isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    ?ㅽ뻾 以?..
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    ?쒕??덉씠???ㅽ뻾
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {backtestWithPolling.isRunning && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative mb-6">
                <div className="h-20 w-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                </div>
              </div>
              <p className="text-lg font-medium text-foreground mb-2">
                {loadingMessages[loadingMessageIndex]}
              </p>
              {backtestWithPolling.progress > 0 && (
                <div className="w-full max-w-xs">
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${backtestWithPolling.progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center mt-2">
                    {backtestWithPolling.progress}% ?꾨즺
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Result Chart */}
          {showResult && chartData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {ticker} ??{startDate} ~ {endDate}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-2xl font-bold",
                    totalReturn !== undefined && totalReturn >= 0
                      ? "text-green-600"
                      : totalReturn !== undefined
                        ? "text-red-500"
                        : "text-muted-foreground"
                  )}>
                    {totalReturn !== undefined ? `${totalReturn > 0 ? "+" : ""}${totalReturn.toFixed(2)}%` : "-"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {finalValue !== undefined ? formatCurrency(finalValue) : "-"}
                  </p>
                </div>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorReturnDetail" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => format(new Date(value), "MM/dd")}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => `${value.toFixed(0)}%`}
                      className="text-muted-foreground"
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                              <p className="text-sm text-muted-foreground mb-1">{label}</p>
                              <p className="text-lg font-bold text-primary">
                                {typeof payload[0].value === 'number' ? payload[0].value.toFixed(2) : payload[0].value}%
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                    <Area
                      type="monotone"
                      dataKey="return"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorReturnDetail)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Summary Stats */}
              <div className="grid gap-3 md:grid-cols-4 mt-6">
                <div className="p-3 rounded-xl bg-secondary/50 text-center">
                  <p className="text-xs text-muted-foreground mb-1">理쒖쥌 ?먯궛</p>
                  <p className="font-bold text-foreground">{finalValue !== undefined ? formatCurrency(finalValue) : "-"}</p>
                </div>
                <div className="p-3 rounded-xl bg-secondary/50 text-center">
                  <p className="text-xs text-muted-foreground mb-1">珥?嫄곕옒</p>
                  <p className="font-bold text-foreground">{totalTrades ?? "-"}회</p>
                </div>
                <div className="p-3 rounded-xl bg-secondary/50 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Profit Factor</p>
                  <p className="font-bold text-foreground">{profitFactor !== undefined ? profitFactor.toFixed(2) : "-"}</p>
                </div>
                <div className="p-3 rounded-xl bg-secondary/50 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Sortino</p>
                  <p className="font-bold text-foreground">{sortinoRatio !== undefined ? sortinoRatio.toFixed(2) : "-"}</p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Section C: Live AI Monitor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card-elevated p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                ?ㅼ떆媛?AI 紐⑤땲??
              </h3>
              <p className="text-sm text-muted-foreground">
                吏湲??뱀옣 ???꾨왂?대씪硫??대뼸寃??좉퉴?
              </p>
            </div>
          </div>

          {/* Live Signal Form */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Label className="text-sm mb-2 block">醫낅ぉ ?좏깮</Label>
              <div className="flex gap-2">
                <Input
                  value={liveSignalTicker}
                  onChange={(e) => setLiveSignalTicker(e.target.value.toUpperCase())}
                  placeholder="AAPL"
                  className="h-11 rounded-xl"
                />
                <Button
                  onClick={handleFetchLiveSignal}
                  disabled={liveSignalLoading}
                  className="h-11 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl gap-2"
                >
                  {liveSignalLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  遺꾩꽍
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {popularTickers.map((t) => (
                  <button
                    key={t}
                    onClick={() => setLiveSignalTicker(t)}
                    className={cn(
                      "px-2 py-0.5 text-xs font-medium rounded-lg transition-colors",
                      liveSignalTicker === t
                        ? "bg-primary text-white"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Loading State */}
          {liveSignalLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative mb-4">
                <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Bot className="h-7 w-7 text-primary animate-pulse" />
                </div>
              </div>
              <p className="text-muted-foreground">AI媛 ?쒖옣??遺꾩꽍?섍퀬 ?덉뒿?덈떎...</p>
            </div>
          )}

          {/* Live Signal Result */}
          {liveSignal && !liveSignalLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Signal Header */}
              <div className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-r from-primary/5 to-blue-500/5 border border-primary/10">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">?꾩옱 ?좏샇</p>
                  <div className="flex items-center gap-4">
                    <SignalBadge signal={liveSignal.signal} size="lg" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        ?좊ː?? <span className="font-medium text-foreground">{liveSignal.confidence}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ?좏샇 媛뺣룄: {(liveSignal.signal_strength * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">
                    ${liveSignal.market_data.current_price.toFixed(2)}
                  </p>
                  <p className={cn(
                    "text-sm font-medium",
                    liveSignal.market_data.change_percent >= 0 ? "text-green-600" : "text-red-500"
                  )}>
                    {liveSignal.market_data.change_percent >= 0 ? "+" : ""}
                    {liveSignal.market_data.change_percent.toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Reasoning */}
              <div className="p-4 rounded-xl bg-secondary/50">
                <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI 遺꾩꽍 寃곌낵
                </h4>
                <ul className="space-y-2">
                  {liveSignal.reasoning.map((reason, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Technical & Market Data Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Technical Data */}
                {liveSignal.technical_data && (
                  <div className="p-4 rounded-xl bg-secondary/50">
                    <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                      <LineChart className="h-4 w-4 text-blue-500" />
                      湲곗닠??遺꾩꽍
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">?④린 MA</span>
                        <span className="font-medium">${liveSignal.technical_data.fast_ma}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">?κ린 MA</span>
                        <span className="font-medium">${liveSignal.technical_data.slow_ma}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">MA ?ㅽ봽?덈뱶</span>
                        <span className={cn(
                          "font-medium",
                          liveSignal.technical_data.ma_spread_percent >= 0 ? "text-green-600" : "text-red-500"
                        )}>
                          {liveSignal.technical_data.ma_spread_percent >= 0 ? "+" : ""}
                          {liveSignal.technical_data.ma_spread_percent}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">異붿꽭</span>
                        <span className="font-medium">{liveSignal.technical_data.trend}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">크로스오버</span>
                        <span className={cn(
                          "font-medium",
                          liveSignal.technical_data.crossover_status === "Golden Cross" ? "text-green-600" :
                            liveSignal.technical_data.crossover_status === "Death Cross" ? "text-red-500" : ""
                        )}>
                          {liveSignal.technical_data.crossover_status}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sentiment Data (AI strategies only) */}
                {liveSignal.sentiment_data && (
                  <div className="p-4 rounded-xl bg-secondary/50">
                    <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                      <Bot className="h-4 w-4 text-purple-500" />
                      ?댁뒪 媛먯꽦 遺꾩꽍
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">?됯퇏 媛먯꽦</span>
                        <span className={cn(
                          "font-medium",
                          liveSignal.sentiment_data.avg_sentiment > 0.2 ? "text-green-600" :
                            liveSignal.sentiment_data.avg_sentiment < -0.2 ? "text-red-500" : ""
                        )}>
                          {liveSignal.sentiment_data.avg_sentiment.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">媛먯꽦 ?쇰꺼</span>
                        <span className="font-medium">{liveSignal.sentiment_data.sentiment_label}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">분석 뉴스</span>
                        <span className="font-medium">{liveSignal.sentiment_data.news_count}건</span>
                      </div>
                    </div>
                    {liveSignal.sentiment_data.latest_news.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-2">理쒓렐 ?댁뒪</p>
                        {liveSignal.sentiment_data.latest_news.slice(0, 2).map((news, i) => (
                          <p key={i} className="text-xs text-muted-foreground truncate mb-1">
                            ??{news.title}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <p className="text-xs text-muted-foreground text-right flex items-center justify-end gap-1">
                <Clock className="h-3 w-3" />
                遺꾩꽍 ?쒓컙: {format(new Date(liveSignal.timestamp), "yyyy-MM-dd HH:mm:ss", { locale: ko })}
              </p>
            </motion.div>
          )}

          {/* Empty State */}
          {!liveSignal && !liveSignalLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h4 className="font-semibold text-foreground mb-2">?ㅼ떆媛?遺꾩꽍 ?쒖옉?섍린</h4>
              <p className="text-sm text-muted-foreground max-w-sm">
                종목을 선택하고 &quot;분석&quot; 버튼을 누르면
                <br />
                AI媛 ?꾩옱 ?쒖옣 ?곹솴??遺꾩꽍?대뱶由쎈땲??
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>?꾨왂????젣?섏떆寃좎뒿?덇퉴?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{strategy?.name}</span> ?꾨왂????젣?⑸땲??
              <br />
              ???묒뾽? ?섎룎由????놁뒿?덈떎.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>痍⑥냼</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              ??젣
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}









