"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import Marquee from "react-fast-marquee";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  LineChart,
  Loader2,
  LogOut,
  Shield,
  Sparkles,
  TrendingUp,
  User,
  Users,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import HeroDashboard from "@/components/landing/HeroDashboard";
import { useAuthStore } from "@/stores/auth-store";

// Ticker data - Clean style
const tickerItems = [
  { symbol: "AAPL", change: "+2.34%", type: "positive" },
  { symbol: "TSLA", change: "-1.52%", type: "negative" },
  { symbol: "NVDA", change: "+4.21%", type: "positive" },
  { symbol: "삼성전자", change: "+1.87%", type: "positive" },
  { symbol: "MSFT", change: "+0.93%", type: "positive" },
  { symbol: "GOOGL", change: "-0.45%", type: "negative" },
];

// Strategies
const strategies = [
  { id: "ai_news", name: "AI 뉴스 분석", description: "실시간 뉴스 감성 분석", return: 42.5 },
  { id: "sma_cross", name: "이동평균 크로스", description: "골든/데드 크로스 전략", return: 28.3 },
  { id: "sentiment", name: "감성 기반 매매", description: "뉴스 + 기술적 분석", return: 35.7 },
];

// Stocks
const stocks = [
  { id: "005930.KS", name: "삼성전자", flag: "🇰🇷" },
  { id: "AAPL", name: "Apple", flag: "🇺🇸" },
  { id: "TSLA", name: "Tesla", flag: "🇺🇸" },
  { id: "NVDA", name: "NVIDIA", flag: "🇺🇸" },
];

// Generate chart data
const generateChartData = (progress: number, finalReturn: number) => {
  const points = 30;
  const data = [];
  for (let i = 0; i <= points; i++) {
    const x = i / points;
    if (x <= progress) {
      const growthRate = finalReturn / 100;
      const baseValue = 100 * Math.pow(1 + growthRate, x);
      const noise = Math.sin(i * 0.8) * 3 + Math.cos(i * 1.2) * 2;
      data.push({
        index: i,
        value: Math.max(baseValue + noise, 95),
      });
    }
  }
  return data;
};

// Counter Component
function AnimatedCounter({ value, duration = 2, suffix = "" }: { value: number; duration?: number; suffix?: string }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => latest.toFixed(1));
  const [displayValue, setDisplayValue] = useState("0.0");

  useEffect(() => {
    const controls = animate(count, value, { duration, ease: "easeOut" });
    const unsubscribe = rounded.on("change", (v) => setDisplayValue(v));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, duration, count, rounded]);

  return <span>{displayValue}{suffix}</span>;
}

// Features
const features = [
  {
    icon: Bot,
    title: "AI 뉴스 분석",
    description: "Gemini AI가 실시간 뉴스를 분석하여 투자 인사이트를 제공합니다.",
  },
  {
    icon: LineChart,
    title: "백테스팅",
    description: "과거 데이터로 전략을 검증하고 최적의 파라미터를 찾습니다.",
  },
  {
    icon: Zap,
    title: "하이브리드 전략",
    description: "기술적 분석과 AI 분석을 결합한 차세대 투자 전략을 사용하세요.",
  },
  {
    icon: Shield,
    title: "리스크 관리",
    description: "자동 손절과 포지션 관리로 자산을 안전하게 보호합니다.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, fetchUser } = useAuthStore();
  const [selectedStock, setSelectedStock] = useState(stocks[0]);
  const [selectedStrategy, setSelectedStrategy] = useState(strategies[0]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationComplete, setSimulationComplete] = useState(false);
  const [chartProgress, setChartProgress] = useState(0);
  const [chartData, setChartData] = useState<{ index: number; value: number }[]>([]);

  // Check auth status on mount
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token && !user) {
      fetchUser();
    }
  }, [fetchUser, user]);

  const handleLogout = () => {
    logout();
    router.refresh();
  };

  const runSimulation = () => {
    setIsSimulating(true);
    setSimulationComplete(false);
    setChartProgress(0);
    setChartData([]);

    const duration = 2000;
    const startTime = Date.now();

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setChartProgress(progress);
      setChartData(generateChartData(progress, selectedStrategy.return));

      if (progress < 1) {
        requestAnimationFrame(updateProgress);
      } else {
        setIsSimulating(false);
        setSimulationComplete(true);
      }
    };

    requestAnimationFrame(updateProgress);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <LineChart className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">EcoQuant</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="#simulator" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              전략 시뮬레이터
            </Link>
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              기능
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost" className="text-muted-foreground hover:text-foreground gap-2">
                    <User className="h-4 w-4" />
                    {user?.full_name || user?.email?.split("@")[0] || "대시보드"}
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  onClick={handleLogout}
                  className="rounded-xl gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  로그아웃
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                    로그인
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl px-5">
                    시작하기
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Ticker */}
      <div className="fixed top-16 left-0 right-0 z-40 ticker-clean border-b border-border">
        <Marquee gradient={false} speed={40} pauseOnHover>
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i} className="ticker-item font-medium">
              <span className="text-foreground">{item.symbol}</span>
              <span className={cn(
                "font-mono",
                item.type === "positive" ? "ticker-positive" : "ticker-negative"
              )}>
                {item.change}
              </span>
            </span>
          ))}
        </Marquee>
      </div>

      {/* Hero Section */}
      <section className="pt-36 pb-20 px-6 gradient-hero overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Left: Text Content */}
            <div className="text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-primary text-sm font-medium mb-6">
                  <Sparkles className="h-4 w-4" />
                  AI 기반 퀀트 투자 플랫폼
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-display text-foreground mb-6 text-balance"
              >
                투자의 정답은 없지만,
                <br />
                <span className="text-primary">오답</span>은 피할 수 있습니다
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg text-muted-foreground mb-10 max-w-xl lg:mx-0 mx-auto leading-relaxed"
              >
                AI가 뉴스를 분석하고, 데이터가 전략을 검증합니다.
                <br />
                감이 아닌 근거로 투자하세요.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <Link href="#simulator">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 text-white rounded-2xl h-14 px-8 text-lg gap-2 shadow-medium">
                    1초 만에 내 전략 검증하기
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="lg" variant="outline" className="rounded-2xl h-14 px-8 text-lg gap-2 border-2">
                    무료로 시작하기
                  </Button>
                </Link>
              </motion.div>
            </div>

            {/* Right: Dashboard Preview */}
            <div className="hidden lg:block">
              <HeroDashboard />
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Simulator */}
      <section id="simulator" className="py-20 px-6 bg-secondary/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-headline text-foreground mb-4">
              지금 바로 체험해보세요
            </h2>
            <p className="text-muted-foreground text-lg">
              로그인 없이 AI 퀀트 전략의 성과를 확인하세요
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="card-elevated p-8"
          >
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Input Form */}
              <div className="space-y-6">
                {/* Stock Selection */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">
                    종목 선택
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {stocks.map((stock) => (
                      <button
                        key={stock.id}
                        onClick={() => setSelectedStock(stock)}
                        className={cn(
                          "card-interactive p-4 text-left",
                          selectedStock.id === stock.id && "selected"
                        )}
                      >
                        <span className="text-lg mr-2">{stock.flag}</span>
                        <span className={cn(
                          "font-medium",
                          selectedStock.id === stock.id ? "text-primary" : "text-foreground"
                        )}>
                          {stock.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Strategy Selection */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">
                    전략 선택
                  </label>
                  <div className="space-y-3">
                    {strategies.map((strategy) => (
                      <button
                        key={strategy.id}
                        onClick={() => setSelectedStrategy(strategy)}
                        className={cn(
                          "card-interactive p-4 w-full text-left flex items-center justify-between",
                          selectedStrategy.id === strategy.id && "selected"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            selectedStrategy.id === strategy.id ? "bg-primary" : "bg-secondary"
                          )}>
                            <Bot className={cn(
                              "h-5 w-5",
                              selectedStrategy.id === strategy.id ? "text-white" : "text-muted-foreground"
                            )} />
                          </div>
                          <div>
                            <p className={cn(
                              "font-medium",
                              selectedStrategy.id === strategy.id ? "text-primary" : "text-foreground"
                            )}>
                              {strategy.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {strategy.description}
                            </p>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-green-500">
                          +{strategy.return}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Run Button */}
                <Button
                  onClick={runSimulation}
                  disabled={isSimulating}
                  className="w-full h-14 text-lg bg-primary hover:bg-primary/90 text-white rounded-2xl gap-3"
                >
                  {isSimulating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      과거 3년 데이터 분석 중...
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5" />
                      시뮬레이션 실행
                    </>
                  )}
                </Button>
              </div>

              {/* Result Chart */}
              <div className="flex flex-col">
                <div className="card-flat p-6 flex-1 min-h-[320px] flex flex-col">
                  {chartData.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {selectedStock.name} × {selectedStrategy.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            2021.01 - 2024.01 (3년)
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-green-500">
                            +<AnimatedCounter value={selectedStrategy.return} duration={2} suffix="%" />
                          </p>
                          <p className="text-sm text-muted-foreground">예상 수익률</p>
                        </div>
                      </div>
                      <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3182f6" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#3182f6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="index" hide />
                            <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke="#3182f6"
                              strokeWidth={2.5}
                              fill="url(#colorValue)"
                              isAnimationActive={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                      <BarChart3 className="h-16 w-16 mb-4 opacity-20" />
                      <p className="text-center">
                        종목과 전략을 선택하고
                        <br />
                        시뮬레이션을 실행해보세요
                      </p>
                    </div>
                  )}
                </div>

                {simulationComplete && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-5 rounded-2xl bg-accent border-2 border-primary/20"
                  >
                    <div className="flex items-center gap-4">
                      <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          이 전략, 지금 바로 시작해보세요
                        </p>
                        <p className="text-sm text-muted-foreground">
                          무료 계정으로 모든 기능을 체험할 수 있습니다
                        </p>
                      </div>
                      <Link href="/register">
                        <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-2">
                          무료 가입
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold text-foreground">1,200+</p>
                <p className="text-sm text-muted-foreground">활성 사용자</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold text-foreground">15,000+</p>
                <p className="text-sm text-muted-foreground">백테스트 실행</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold text-foreground">+24.5%</p>
                <p className="text-sm text-muted-foreground">평균 수익률</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-secondary/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-headline text-foreground mb-4">
              왜 EcoQuant인가요?
            </h2>
            <p className="text-muted-foreground text-lg">
              개인 투자자도 기관 수준의 분석 도구를 사용할 수 있습니다
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="card-elevated p-6 hover:shadow-medium"
              >
                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <h2 className="text-headline text-foreground mb-4">
              지금 바로 시작하세요
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              무료로 가입하고 AI 기반 퀀트 투자를 경험해보세요.
              <br />
              신용카드 없이 바로 시작할 수 있습니다.
            </p>
            <Link href="/register">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-white rounded-2xl h-14 px-10 text-lg gap-2 shadow-medium">
                무료 계정 만들기
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6 bg-secondary/30">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <LineChart className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-foreground">EcoQuant</span>
          </div>

          <p className="text-sm text-muted-foreground">
            © 2026 EcoQuant. All rights reserved.
          </p>

          <div className="flex items-center gap-6">
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              이용약관
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              개인정보처리방침
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
