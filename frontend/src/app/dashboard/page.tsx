"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  LineChart,
  Newspaper,
  Plus,
  TrendingUp,
  Wallet,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBacktests } from "@/hooks/use-backtests";
import { useStrategies } from "@/hooks/use-strategies";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { ComingSoonModal } from "@/components/ui/coming-soon-modal";

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

// ?멸린 ?꾨왂 異붿쿇 (?뺤쟻 ?곗씠??
const recommendedStrategies = [
  {
    id: "sentiment_sma",
    name: "AI ?댁뒪 ?щ━ ?꾨왂",
    description: "?댁뒪 媛먯꽦 遺꾩꽍 + ?대룞?됯퇏??議고빀",
    icon: Bot,
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
    expectedReturn: "+15~25%",
    risk: "以묎컙",
  },
  {
    id: "sma_crossover",
    name: "怨⑤뱺?щ줈???꾨왂",
    description: "?④린/?κ린 ?대룞?됯퇏??援먯감 留ㅻℓ",
    icon: TrendingUp,
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    expectedReturn: "+10~20%",
    risk: "??쓬",
  },
  {
    id: "sentiment_sma_aggressive",
    name: "怨듦꺽??媛먯꽦 ?꾨왂",
    description: "?믪? ?꾪뿕, ?믪? ?섏씡 異붽뎄",
    icon: BarChart3,
    iconBg: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
    expectedReturn: "+25~40%",
    risk: "?믪쓬",
  },
];

export default function DashboardPage() {
  const { data: backtestsData, isLoading: backtestsLoading } = useBacktests(
    undefined,
    1,
    5,
    { refetchOnMount: true, livePolling: true }
  );
  const { data: strategiesData, isLoading: strategiesLoading } = useStrategies(1, 10);
  
  // 以鍮?以?紐⑤떖 ?곹깭
  const [comingSoonModal, setComingSoonModal] = useState<{
    isOpen: boolean;
    feature: string;
    description?: string;
    alternativeAction?: { label: string; href: string };
  }>({
    isOpen: false,
    feature: "",
  });

  const openComingSoonModal = (
    feature: string, 
    description?: string,
    alternativeAction?: { label: string; href: string }
  ) => {
    setComingSoonModal({ isOpen: true, feature, description, alternativeAction });
  };

  const closeComingSoonModal = () => {
    setComingSoonModal({ ...comingSoonModal, isOpen: false });
  };

  // 怨꾩궛???듦퀎 (?ㅼ젣 ?곗씠??湲곕컲)
  const totalBacktests = backtestsData?.total || 0;
  const completedBacktests = backtestsData?.items?.filter((b) => b.status === "completed") || [];
  const avgReturn = completedBacktests.length > 0 
    ? completedBacktests.reduce((sum, b) => sum + (b.total_return || 0), 0) / completedBacktests.length 
    : 0;
  const activeStrategies = strategiesData?.total || 0;

  const statsCards = [
    {
      title: "총 자산 (가상)",
      value: "₩100,000,000",
      change: avgReturn > 0 ? `+${avgReturn.toFixed(1)}%` : `${avgReturn.toFixed(1)}%`,
      changeLabel: "평균 수익률",
      changeType: avgReturn >= 0 ? "positive" as const : "negative" as const,
      icon: Wallet,
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      title: "이번 달 수익률",
      value: avgReturn > 0 ? `+${avgReturn.toFixed(1)}%` : `${avgReturn.toFixed(1)}%`,
      change: completedBacktests.length > 0 ? `${completedBacktests.length}건` : "0건",
      changeLabel: "완료된 백테스트",
      changeType: "neutral" as const,
      icon: TrendingUp,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "활성 전략",
      value: activeStrategies.toString(),
      change: activeStrategies > 0 ? `+${activeStrategies}` : "0",
      changeLabel: activeStrategies > 0 ? "사용 가능" : "전략을 만들어보세요",
      changeType: activeStrategies > 0 ? "positive" as const : "neutral" as const,
      icon: LineChart,
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
    {
      title: "백테스트 실행",
      value: totalBacktests.toString(),
      change: "AI 분석",
      changeLabel: "감성 분석 사용",
      changeType: "neutral" as const,
      icon: BarChart3,
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Page Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">대시보드</h1>
            <p className="text-muted-foreground mt-1">전략과 백테스트 성과를 한눈에 확인하세요.</p>
          </div>
          <Link href="/dashboard/backtest">
            <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-2">
              <LineChart className="h-4 w-4" />
              ??諛깊뀒?ㅽ듃
            </Button>
          </Link>
        </motion.div>

        {/* ?꾨왂 ?놁쓬 ?덈궡 諛곕꼫 */}
        {!strategiesLoading && activeStrategies === 0 && (
          <motion.div
            variants={itemVariants}
            className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-blue-500/10 to-purple-500/10 border border-primary/20"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                <AlertCircle className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">
                  泥??꾨왂??留뚮뱾?대낫?몄슂!
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  ?꾨왂???앹꽦?섎㈃ 諛깊뀒?ㅽ듃瑜??ㅽ뻾?섍퀬 AI 遺꾩꽍 寃곌낵瑜??뺤씤?????덉뒿?덈떎.
                </p>
                <Link href="/dashboard/strategies/new">
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-lg gap-2">
                    <Plus className="h-4 w-4" />
                    ?꾨왂 留뚮뱾湲?                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats Grid */}
        <motion.div variants={containerVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((stat) => (
            <motion.div
              key={stat.title}
              variants={itemVariants}
              className="card-elevated p-5 hover:shadow-medium"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                  {backtestsLoading || strategiesLoading ? (
                    <Skeleton className="h-9 w-24 mb-2" />
                  ) : (
                    <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  )}
                  <p className="text-sm mt-2 flex items-center gap-1">
                    {stat.changeType === "positive" && (
                      <span className="flex items-center text-green-600 dark:text-green-400">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        {stat.change}
                      </span>
                    )}
                    {stat.changeType === "negative" && (
                      <span className="flex items-center text-red-500">
                        <ArrowDownRight className="h-3.5 w-3.5" />
                        {stat.change}
                      </span>
                    )}
                    {stat.changeType === "neutral" && (
                      <span className="text-primary font-medium">{stat.change}</span>
                    )}
                    <span className="text-muted-foreground ml-1">{stat.changeLabel}</span>
                  </p>
                </div>
                <div className={cn("p-3 rounded-xl", stat.iconBg)}>
                  <stat.icon className={cn("h-5 w-5", stat.iconColor)} />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* My Strategies Section */}
        {strategiesData?.items && strategiesData.items.length > 0 && (
          <motion.div variants={itemVariants} className="card-elevated p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                ???쒖꽦 ?꾨왂
              </h2>
              <Link href="/dashboard/strategies">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10 gap-1 rounded-lg">
                  ?꾩껜 愿由?                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {strategiesData.items.slice(0, 3).map((strategy) => {
                const isAi = strategy.strategy_type?.toLowerCase().includes("sentiment");
                return (
                  <Link 
                    key={strategy.id} 
                    href={`/dashboard/strategies/${strategy.id}`}
                    className="block"
                  >
                    <div className="p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer h-full">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg",
                          isAi 
                            ? "bg-purple-100 dark:bg-purple-900/30" 
                            : "bg-blue-100 dark:bg-blue-900/30"
                        )}>
                          {isAi ? (
                            <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          ) : (
                            <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{strategy.name}</p>
                          {isAi && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                              AI
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(strategy.created_at), { addSuffix: true, locale: ko })}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Backtests */}
          <motion.div variants={itemVariants} className="card-elevated p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">理쒓렐 諛깊뀒?ㅽ듃</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => openComingSoonModal(
                  "諛깊뀒?ㅽ듃 湲곕줉",
                  "紐⑤뱺 諛깊뀒?ㅽ듃 湲곕줉???쒕늿??蹂????덈뒗 ?섏씠吏瑜?以鍮?以묒엯?덈떎.",
                  { label: "??諛깊뀒?ㅽ듃 ?ㅽ뻾", href: "/dashboard/backtest" }
                )}
                className="text-primary hover:text-primary hover:bg-primary/10 gap-1 rounded-lg"
              >
                紐⑤몢 蹂닿린
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            
            {backtestsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : backtestsData?.items && backtestsData.items.length > 0 ? (
              <div className="space-y-3">
                {backtestsData.items.slice(0, 4).map((backtest, index) => (
                  <Link 
                    key={backtest.id} 
                    href={`/dashboard/backtest?id=${backtest.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors">
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            backtest.status === "completed"
                              ? "bg-green-500"
                              : backtest.status === "running" || backtest.status === "pending"
                                ? "bg-primary animate-pulse"
                                : "bg-red-500"
                          )}
                        />
                        <div>
                          <p className="font-medium text-foreground flex items-center gap-2">
                            諛깊뀒?ㅽ듃 #{backtest.id}
                            {backtest.status === "completed" && index === 0 && (
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  방금 완료
                                </span>
                              )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {backtest.start_date} ~ {backtest.end_date} ??{" "}
                            {formatDistanceToNow(new Date(backtest.created_at), { 
                              addSuffix: true, 
                              locale: ko 
                            })}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "font-mono text-sm font-semibold",
                          backtest.total_return !== null &&
                          backtest.total_return !== undefined &&
                          backtest.total_return > 0
                            ? "text-green-600 dark:text-green-400"
                            : backtest.total_return !== null &&
                                backtest.total_return !== undefined &&
                                backtest.total_return < 0
                              ? "text-red-500"
                              : "text-muted-foreground"
                        )}
                      >
                        {backtest.status === "completed" &&
                        backtest.total_return !== null &&
                        backtest.total_return !== undefined
                          ? `${backtest.total_return > 0 ? "+" : ""}${backtest.total_return.toFixed(1)}%`
                          : backtest.status === "running" || backtest.status === "pending"
                            ? "진행 중"
                            : backtest.status === "failed"
                              ? "?ㅽ뙣"
                              : "-"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                  <LineChart className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  泥??뚯뒪?몃? ?쒖옉?대낫?몄슂
                </h3>
                <p className="text-muted-foreground mb-4 max-w-sm">
                  {activeStrategies === 0 
                    ? "癒쇱? ?꾨왂???앹꽦????諛깊뀒?ㅽ듃瑜??ㅽ뻾?대낫?몄슂."
                    : "?꾨왂???좏깮?섍퀬 諛깊뀒?ㅽ듃瑜??ㅽ뻾?섏뿬 ?깃낵瑜??뺤씤?섏꽭??"}
                </p>
                <Link href={activeStrategies === 0 ? "/dashboard/strategies/new" : "/dashboard/backtest"}>
                  <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-2">
                    <Plus className="h-4 w-4" />
                    {activeStrategies === 0 ? "전략 만들기" : "백테스트 시작"}
                  </Button>
                </Link>
              </div>
            )}
          </motion.div>

          {/* ?멸린 ?꾨왂 異붿쿇 */}
          <motion.div variants={itemVariants} className="card-elevated p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">?멸린 ?꾨왂 異붿쿇</h2>
              <Link href="/dashboard/strategies/new">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10 gap-1 rounded-lg">
                  ?꾨왂 留뚮뱾湲?                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {recommendedStrategies.map((strategy) => (
                <Link key={strategy.id} href={`/dashboard/strategies/new?type=${strategy.id}`} className="block">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer">
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", strategy.iconBg)}>
                      <strategy.icon className={cn("h-6 w-6", strategy.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{strategy.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{strategy.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {strategy.expectedReturn}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ?꾪뿕: {strategy.risk}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants} className="card-elevated p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">鍮좊Ⅸ ?묒뾽</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/dashboard/strategies/new" className="block">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer h-full">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <Plus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">???꾨왂 ?앹꽦</p>
                  <p className="text-sm text-muted-foreground">留덈쾿?щ줈 ?쎄쾶 ?꾨왂 ?ㅼ젙</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>

            <Link href="/dashboard/backtest" className="block">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer h-full">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">諛깊뀒?ㅽ듃 ?ㅽ뻾</p>
                  <p className="text-sm text-muted-foreground">전략 성과 시뮬레이션</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>

            <button 
              onClick={() => openComingSoonModal(
                "?댁뒪 遺꾩꽍",
                "AI媛 遺꾩꽍??理쒖떊 湲덉쑖 ?댁뒪? 媛먯꽦 ?먯닔瑜??뺤씤?????덈뒗 湲곕뒫?낅땲?? ?댁뒪 湲곕컲 ?ъ옄 ?몄궗?댄듃瑜??쒓났?⑸땲??",
                { label: "AI 전략 만들기", href: "/dashboard/strategies/new?type=sentiment_sma" }
              )}
              className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer h-full text-left w-full"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Newspaper className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">?댁뒪 遺꾩꽍</p>
                <p className="text-sm text-muted-foreground">AI 媛먯꽦 遺꾩꽍 寃곌낵</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* Coming Soon Modal */}
      <ComingSoonModal
        isOpen={comingSoonModal.isOpen}
        onClose={closeComingSoonModal}
        feature={comingSoonModal.feature}
        description={comingSoonModal.description}
        alternativeAction={comingSoonModal.alternativeAction}
      />
    </>
  );
}





