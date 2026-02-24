"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bot,
  Check,
  LineChart,
  Loader2,
  Play,
  Plus,
  RefreshCcw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useStrategies } from "@/hooks/use-strategies";
import { useBacktestWithPolling, useBacktest } from "@/hooks/use-backtests";
import { Skeleton } from "@/components/ui/skeleton";

// Loading messages that cycle during backtest
const loadingMessages = [
  "AI媛 3?꾩튂 ?댁뒪瑜??쎄퀬 ?덉뒿?덈떎...",
  "怨쇨굅 李⑦듃 ?⑦꽩???議?以?..",
  "?대룞?됯퇏??怨⑤뱺?щ줈???먯? 以?..",
  "媛먯꽦 ?먯닔瑜?遺꾩꽍?섍퀬 ?덉뒿?덈떎...",
  "留ㅻℓ ?좏샇瑜?怨꾩궛?섎뒗 以?..",
  "?섏씡瑜좎쓣 怨꾩궛?섍퀬 ?덉뒿?덈떎...",
  "由ъ뒪??吏?쒕? 痢≪젙 以?..",
  "理쒖쟻??留ㅻℓ ??대컢 遺꾩꽍 以?..",
];

// Popular tickers
const popularTickers = ["AAPL", "TSLA", "NVDA", "MSFT", "GOOGL", "AMZN", "META"];

// Suggested strategies for empty state
const suggestedStrategies = [
  {
    id: "sentiment_sma",
    name: "AI ?댁뒪 ?щ━ ?꾨왂",
    description: "?댁뒪 媛먯꽦 遺꾩꽍 + ?대룞?됯퇏??議고빀",
    icon: Bot,
    color: "text-purple-600",
    bg: "bg-purple-100 dark:bg-purple-900/30",
  },
  {
    id: "sma_crossover",
    name: "怨⑤뱺?щ줈???꾨왂",
    description: "?대룞?됯퇏??援먯감 留ㅻℓ",
    icon: TrendingUp,
    color: "text-blue-600",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },
];

function hasDefinedNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined;
}

export default function BacktestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewId = searchParams.get("id");
  const newParam = searchParams.get("new"); // Used to force reset

  const { data: strategiesData, isLoading: strategiesLoading } = useStrategies(1, 50);
  const backtestWithPolling = useBacktestWithPolling();
  const resetBacktestPolling = backtestWithPolling.reset;
  const { data: viewBacktest, isLoading: viewLoading } = useBacktest(viewId ? parseInt(viewId) : 0);

  const [selectedStrategyId, setSelectedStrategyId] = useState<string>("");
  const [ticker, setTicker] = useState("AAPL");
  const [startDate, setStartDate] = useState("2023-01-01");
  const [endDate, setEndDate] = useState("2024-01-01");
  const [initialCapital, setInitialCapital] = useState("100000000"); // 1?듭썝 (100 million)
  const [positionSize, setPositionSize] = useState("1.0"); // 100% of portfolio
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Reset polling state when new param changes (clicking "??諛깊뀒?ㅽ듃" button)
  useEffect(() => {
    if (newParam) {
      resetBacktestPolling();
      // Clean URL without the new param
      router.replace("/dashboard/backtest");
    }
  }, [newParam, resetBacktestPolling, router]);

  // Check if no strategies exist
  const hasNoStrategies = !strategiesLoading && (!strategiesData?.items || strategiesData.items.length === 0);

  // Cycle through loading messages
  useEffect(() => {
    if (backtestWithPolling.isRunning) {
      const interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [backtestWithPolling.isRunning]);

  // Use viewBacktest result if viewing, otherwise use polling result
  const result = viewId ? viewBacktest : backtestWithPolling.result;
  // Generate chart data from equity curve or mock it
  const chartData = useMemo(() => {
    if (result?.equity_curve && result.equity_curve.length > 0) {
      return result.equity_curve.map((point) => ({
        date: point.date,
        value: point.value,
        return: ((point.value - (result.initial_capital || 10000000)) / (result.initial_capital || 10000000)) * 100,
      }));
    }

    // Generate mock data if no equity curve
    if (result?.status === "completed" && hasDefinedNumber(result?.total_return)) {
      const days = 252; // Trading days in a year
      const startValue = result.initial_capital || 10000000;
      const endValue = startValue * (1 + result.total_return / 100);
      const data = [];

      for (let i = 0; i <= days; i++) {
        const progress = i / days;
        const noise = Math.sin(i * 0.17) * 0.01;
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
  }, [result]);

  const handleRunBacktest = async () => {
    if (!selectedStrategyId) {
      toast.error("?꾨왂???좏깮?댁＜?몄슂");
      return;
    }
    if (!ticker) {
      toast.error("醫낅ぉ 肄붾뱶瑜??낅젰?댁＜?몄슂");
      return;
    }

    try {
      await backtestWithPolling.runBacktest({
        strategy_id: parseInt(selectedStrategyId),
        symbols: [ticker.toUpperCase()],
        start_date: startDate,
        end_date: endDate,
        initial_capital: parseInt(initialCapital),
        position_size: parseFloat(positionSize),
      });
    } catch {
      // Error handled by hook
    }
  };

  const handleReset = () => {
    backtestWithPolling.reset();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // CRITICAL: Show result when status is COMPLETED, regardless of data content
  // Use backtestWithPolling.isCompleted for more reliable state detection
  const statusCompleted = result?.status === "completed" || backtestWithPolling.status === "completed";
  const statusFailed = result?.status === "failed" || backtestWithPolling.status === "failed";
  // Show result even if total_return is 0 or no trades
  const showResult = statusCompleted && !backtestWithPolling.isRunning;
  const showFailed = statusFailed && !backtestWithPolling.isRunning;
  const failedMessage = result?.error_message || backtestWithPolling.message || "?????녿뒗 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.";
  const totalReturn = hasDefinedNumber(result?.total_return) ? result.total_return : undefined;
  const mdd = hasDefinedNumber(result?.mdd) ? result.mdd : undefined;
  const finalValue = hasDefinedNumber(result?.final_value) ? result.final_value : undefined;
  const winRate = hasDefinedNumber(result?.win_rate) ? result.win_rate : undefined;
  const winningTrades = hasDefinedNumber(result?.winning_trades) ? result.winning_trades : undefined;
  const losingTrades = hasDefinedNumber(result?.losing_trades) ? result.losing_trades : undefined;
  const sharpeRatio = hasDefinedNumber(result?.sharpe_ratio) ? result.sharpe_ratio : undefined;
  const sortinoRatio = hasDefinedNumber(result?.sortino_ratio) ? result.sortino_ratio : undefined;
  const totalTrades = hasDefinedNumber(result?.total_trades) ? result.total_trades : undefined;
  const profitFactor = hasDefinedNumber(result?.profit_factor) ? result.profit_factor : undefined;

  // No strategies state - full page
  if (hasNoStrategies && !viewId) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">諛깊뀒?ㅽ똿</h1>
          <p className="text-muted-foreground mt-1">?꾨왂??怨쇨굅 ?깃낵瑜??쒕??덉씠?섑븯?몄슂</p>
        </div>

        {/* No Strategy Alert */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-elevated p-8"
        >
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="relative mb-6">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-blue-500/20">
                <AlertCircle className="h-12 w-12 text-primary" />
              </div>
              <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">
              ?꾨왂???꾩쭅 ?놁뒿?덈떎
            </h2>
            <p className="text-muted-foreground max-w-md mb-8">
              諛깊뀒?ㅽ듃瑜??ㅽ뻾?섎젮硫?癒쇱? ?ъ옄 ?꾨왂??留뚮뱾?댁빞 ?⑸땲??
              <br />
              AI ?댁뒪 遺꾩꽍 ?꾨왂??異붿쿇?쒕┰?덈떎!
            </p>

            {/* Suggested Strategies */}
            <div className="w-full max-w-lg mb-8">
              <p className="text-sm font-medium text-muted-foreground mb-4">
                異붿쿇 ?꾨왂?쇰줈 鍮좊Ⅴ寃??쒖옉?섏꽭??              </p>
              <div className="grid gap-3">
                {suggestedStrategies.map((strategy) => (
                  <Link
                    key={strategy.id}
                    href={`/dashboard/strategies/new?type=${strategy.id}`}
                    className="block"
                  >
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-secondary/50 hover:bg-secondary transition-all hover:scale-[1.02] cursor-pointer border border-transparent hover:border-primary/20">
                      <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", strategy.bg)}>
                        <strategy.icon className={cn("h-6 w-6", strategy.color)} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-foreground">{strategy.name}</p>
                        <p className="text-sm text-muted-foreground">{strategy.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-primary font-medium">異붿쿇</span>
                        <Plus className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Main CTA */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/dashboard/strategies/new">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-white rounded-xl h-12 px-8 gap-2">
                  <Plus className="h-5 w-5" />
                  ???꾨왂 留뚮뱾湲?                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" size="lg" className="rounded-xl h-12 px-8 gap-2">
                  <ArrowLeft className="h-5 w-5" />
                  ??쒕낫?쒕줈 ?뚯븘媛湲?                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {viewId ? "諛깊뀒?ㅽ듃 寃곌낵" : "諛깊뀒?ㅽ똿"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {viewId ? "과거 시뮬레이션 결과를 확인하세요" : "전략의 과거 성과를 시뮬레이션합니다"}
          </p>
        </div>
        {viewId && (
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/backtest")}
            className="rounded-xl gap-2"
          >
            <Plus className="h-4 w-4" />
            ??諛깊뀒?ㅽ듃
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Settings Panel */}
        {!viewId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-1"
          >
            <div className="card-elevated p-6 space-y-6 sticky top-24">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                ?쒕??덉씠???ㅼ젙
              </h2>

              {/* Strategy Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">?꾨왂 ?좏깮</Label>
                <Select
                  value={selectedStrategyId}
                  onValueChange={setSelectedStrategyId}
                  disabled={backtestWithPolling.isRunning}
                >
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="전략을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {strategiesLoading ? (
                      <div className="p-4 text-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                        濡쒕뵫 以?..
                      </div>
                    ) : strategiesData?.items && strategiesData.items.length > 0 ? (
                      strategiesData.items.map((strategy) => (
                        <SelectItem key={strategy.id} value={strategy.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span>{strategy.name}</span>
                            {strategy.strategy_type?.includes("SENTIMENT") && (
                              <Bot className="h-3.5 w-3.5 text-purple-500" />
                            )}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-4 text-center">
                        <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">??λ맂 ?꾨왂???놁뒿?덈떎</p>
                        <Link href="/dashboard/strategies/new">
                          <Button size="sm" className="rounded-lg gap-1">
                            <Plus className="h-3 w-3" />
                            ?꾨왂 留뚮뱾湲?                          </Button>
                        </Link>
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {!strategiesLoading && strategiesData?.items && strategiesData.items.length > 0 && !selectedStrategyId && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    ?꾨왂???좏깮?댁＜?몄슂
                  </p>
                )}
              </div>

              {/* Ticker Input */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">醫낅ぉ 肄붾뱶 (Ticker)</Label>
                <Input
                  placeholder="?? AAPL, TSLA"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  disabled={backtestWithPolling.isRunning}
                  className="h-12 rounded-xl"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {popularTickers.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTicker(t)}
                      disabled={backtestWithPolling.isRunning}
                      className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-lg transition-colors",
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

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">시작일</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={backtestWithPolling.isRunning}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">종료일</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={backtestWithPolling.isRunning}
                    className="h-12 rounded-xl"
                  />
                </div>
              </div>

              {/* Initial Capital */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  珥덇린 ?먮낯湲?                </Label>
                <Input
                  type="number"
                  placeholder="100000000"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(e.target.value)}
                  disabled={backtestWithPolling.isRunning}
                  className="h-12 rounded-xl"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    { label: "1泥쒕쭔", value: "10000000" },
                    { label: "1억", value: "100000000" },
                    { label: "10억", value: "1000000000" },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setInitialCapital(preset.value)}
                      disabled={backtestWithPolling.isRunning}
                      className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-lg transition-colors",
                        initialCapital === preset.value
                          ? "bg-primary text-white"
                          : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(parseInt(initialCapital) || 0)}
                </p>
              </div>

              {/* Position Size */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  ?ъ????ш린 (嫄곕옒 鍮꾩쨷)
                </Label>
                <Select
                  value={positionSize}
                  onValueChange={setPositionSize}
                  disabled={backtestWithPolling.isRunning}
                >
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="嫄곕옒 鍮꾩쨷 ?좏깮" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.25">25% (蹂댁닔??</SelectItem>
                    <SelectItem value="0.5">50% (以묐┰)</SelectItem>
                    <SelectItem value="0.75">75% (?곴레)</SelectItem>
                    <SelectItem value="1.0">100% (?꾩븸)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  留ㅻℓ ???먮낯??{Math.round(parseFloat(positionSize) * 100)}%瑜??ъ슜?⑸땲??                </p>
              </div>

              {/* Run Button */}
              <Button
                onClick={handleRunBacktest}
                disabled={backtestWithPolling.isRunning || !selectedStrategyId}
                className="w-full h-14 text-lg bg-primary hover:bg-primary/90 text-white rounded-xl gap-2"
              >
                {backtestWithPolling.isRunning ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    ?쒕??덉씠??以?..
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5" />
                    ?? ?쒕??덉씠???쒖옉
                  </>
                )}
              </Button>

              {showResult && (
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="w-full rounded-xl gap-2"
                >
                  <RefreshCcw className="h-4 w-4" />
                  ?덈줈???뚯뒪??                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* Results Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={viewId ? "lg:col-span-3" : "lg:col-span-2"}
        >
          <AnimatePresence mode="wait">
            {/* Loading State */}
            {backtestWithPolling.isRunning && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card-elevated p-8"
              >
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="relative mb-8">
                    <div className="h-24 w-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                    </div>
                  </div>

                  <motion.p
                    key={loadingMessageIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-xl font-medium text-foreground mb-2 text-center"
                  >
                    {loadingMessages[loadingMessageIndex]}
                  </motion.p>

                  {backtestWithPolling.progress > 0 && (
                    <div className="w-full max-w-xs mt-4">
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-primary rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${backtestWithPolling.progress}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground text-center mt-2">
                        {backtestWithPolling.progress}% ?꾨즺
                      </p>
                    </div>
                  )}

                  <p className="text-muted-foreground text-sm mt-4">
                    ?좎떆留?湲곕떎?ㅼ＜?몄슂...
                  </p>
                </div>
              </motion.div>
            )}

            {/* Failed State */}
            {showFailed && (
              <motion.div
                key="failed"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card-elevated p-8"
              >
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
                    <AlertCircle className="h-12 w-12 text-red-500" />
                  </div>

                  <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
                    諛깊뀒?ㅽ듃 ?ㅽ뙣
                  </h3>

                  <p className="text-muted-foreground text-center mb-6 max-w-md">
                    ?쒕??덉씠??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.
                  </p>

                  {/* Error Details */}
                  <div className="w-full max-w-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                      ?ㅻ쪟 ?댁슜:
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 break-words">
                      {failedMessage}
                    </p>
                  </div>

                  {/* Suggestions */}
                  <div className="w-full max-w-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      ?닿껐 諛⑸쾿 ?쒖븞
                    </p>
                    <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                      <li>
                        <strong>초기 자본금</strong>을 더 크게 설정해보세요 (최소 1억 권장)
                      </li>
                      <li>
                        <strong>포지션 크기</strong>를 낮춰보세요 (50% 이하)
                      </li>
                      <li>
                        <strong>시작일/종료일</strong>의 유효성을 확인해보세요
                      </li>
                      <li>
                        <strong>다른 종목 코드</strong>를 시도해보세요
                      </li>
                    </ul>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={handleReset}
                      className="bg-primary hover:bg-primary/90 text-white rounded-xl h-12 px-6 gap-2"
                    >
                      <RefreshCcw className="h-5 w-5" />
                      ?ㅼ젙 ?섏젙?섍퀬 ?ㅼ떆 ?쒕룄
                    </Button>
                    <Link href="/dashboard">
                      <Button variant="outline" className="rounded-xl h-12 px-6 gap-2">
                        <ArrowLeft className="h-5 w-5" />
                        ??쒕낫?쒕줈 ?뚯븘媛湲?                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Result State */}
            {showResult && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                {result?.status === "completed" && (
                    <div className="p-4 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">
                        방금 완료된 백테스트입니다. 대시보드에 최신 결과가 반영되었습니다.
                      </p>
                    </div>
                  )}

                {/* No trades - Toss Style Card */}
                {(result.total_trades === 0 || result.total_trades === undefined) && (
                  <div className="bg-white rounded-[20px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-[#e5e8eb] p-8">
                    <div className="flex flex-col items-center text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 mb-4">
                        <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h3 className="text-xl font-bold text-[#191f28] dark:text-foreground mb-2">
                        議곌굔??留욌뒗 嫄곕옒媛 諛쒖깮?섏? ?딆븯?듬땲??                      </h3>
                      <p className="text-[#4e5968] dark:text-muted-foreground max-w-md mb-6">
                        ?쒕??덉씠??湲곌컙 ?숈븞 ?꾨왂 議곌굔??留뚯”?섎뒗 留ㅻℓ ?좏샇媛 ?놁뿀?듬땲??
                        <br />
                        ?섏씡瑜?0%濡?諛깊뀒?ㅽ듃媛 ?꾨즺?섏뿀?듬땲??
                      </p>
                      <div className="w-full max-w-md p-4 rounded-xl bg-[#f2f4f6] dark:bg-secondary/50">
                        <p className="text-sm font-medium text-[#4e5968] dark:text-muted-foreground mb-3">
                          ?뮕 ?ㅼ쓬???쒕룄?대낫?몄슂
                        </p>
                        <ul className="text-sm text-[#4e5968] dark:text-muted-foreground space-y-2 text-left">
                          <li className="flex items-start gap-2">
                            <span className="text-[#3182f6]">•</span>
                            <span>더 긴 기간으로 설정해보세요 (최소 1년 권장)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#3182f6]">•</span>
                            <span>단기/장기 이동평균 기간을 조정해보세요</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#3182f6]">•</span>
                            <span>다른 종목도 시도해보세요</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Key Metrics */}
                <div className="grid gap-4 md:grid-cols-3">
                  {/* Total Return */}
                  <div className="card-elevated p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">총 수익률</span>
                      {totalReturn === undefined ? (
                        <BarChart3 className="h-5 w-5 text-muted-foreground" />
                      ) : totalReturn >= 0 ? (
                        <ArrowUpRight className="h-5 w-5 text-green-500" />
                      ) : (
                        <ArrowDownRight className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <p
                      className={cn(
                        "text-4xl font-bold",
                        totalReturn !== undefined && totalReturn >= 0
                          ? "text-green-600 dark:text-green-400"
                          : totalReturn !== undefined
                            ? "text-red-500"
                            : "text-muted-foreground"
                      )}
                    >
                      {totalReturn !== undefined
                        ? `${totalReturn > 0 ? "+" : ""}${totalReturn.toFixed(2)}%`
                        : "-"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {finalValue !== undefined ? formatCurrency(finalValue) : "-"}
                    </p>
                  </div>

                  {/* MDD */}
                  <div className="card-elevated p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">理쒕? ?숉룺 (MDD)</span>
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    </div>
                    <p className="text-4xl font-bold text-red-500">
                      {mdd !== undefined ? `${mdd.toFixed(2)}%` : "-"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Maximum Drawdown
                    </p>
                  </div>

                  {/* Win Rate */}
                  <div className="card-elevated p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">?밸쪧</span>
                      <Target className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-4xl font-bold text-primary">
                      {winRate !== undefined ? `${(winRate * 100).toFixed(1)}%` : "-"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {winningTrades ?? "-"}??/ {losingTrades ?? "-"}??                    </p>
                  </div>
                </div>

                {/* Chart */}
                <div className="card-elevated p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <LineChart className="h-5 w-5 text-primary" />
                    ?섏씡瑜?怨≪꽑
                  </h3>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorReturn" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => format(new Date(value), "MM/dd")}
                          className="text-muted-foreground"
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `${value.toFixed(1)}%`}
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
                                  <p className="text-sm text-muted-foreground">
                                    {formatCurrency(payload[0].payload?.value || 0)}
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
                          fill="url(#colorReturn)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Additional Metrics */}
                <div className="card-elevated p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    ?곸꽭 吏??                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="p-4 rounded-xl bg-secondary/50">
                      <p className="text-sm text-muted-foreground mb-1">?ㅽ봽 鍮꾩쑉</p>
                      <p className="text-2xl font-bold text-foreground">
                        {sharpeRatio !== undefined ? sharpeRatio.toFixed(2) : "-"}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-secondary/50">
                      <p className="text-sm text-muted-foreground mb-1">?뚮Ⅴ?곕끂 鍮꾩쑉</p>
                      <p className="text-2xl font-bold text-foreground">
                        {sortinoRatio !== undefined ? sortinoRatio.toFixed(2) : "-"}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-secondary/50">
                      <p className="text-sm text-muted-foreground mb-1">총 거래 수</p>
                      <p className="text-2xl font-bold text-foreground">
                        {totalTrades ?? "-"}??                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-secondary/50">
                      <p className="text-sm text-muted-foreground mb-1">Profit Factor</p>
                      <p className="text-2xl font-bold text-foreground">
                        {profitFactor !== undefined ? profitFactor.toFixed(2) : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Initial State */}
            {!backtestWithPolling.isRunning && !showResult && !showFailed && !viewId && (
              <motion.div
                key="initial"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="card-elevated p-8"
              >
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 mb-6">
                    <BarChart3 className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    백테스트를 실행하세요
                  </h3>
                  <p className="text-muted-foreground max-w-md mb-6">
                    왼쪽 설정에서 전략과 기간을 지정한 뒤
                    <br />
                    시뮬레이션을 시작하면 결과가 여기 표시됩니다.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>AI 뉴스 분석 지원</span>
                    <Check className="h-4 w-4 text-green-500 ml-4" />
                    <span>?ㅼ떆媛?吏꾪뻾 ?곹솴</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* View Loading */}
            {viewId && viewLoading && (
              <motion.div
                key="view-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="grid gap-4 md:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 rounded-2xl" />
                  ))}
                </div>
                <Skeleton className="h-[500px] rounded-2xl" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}





