"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
  XAxis,
  Tooltip,
} from "recharts";
import {
  BarChart3,
  Bot,
  Briefcase,
  LineChart,
  Settings,
  TrendingUp,
  Wallet,
  Target,
  Activity,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Newspaper,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Realistic backtest result data
const backtestConfig = {
  strategy: "AI 뉴스 심리 + SMA 크로스",
  ticker: "NVDA",
  period: "2023.01 - 2024.01",
  initialCapital: 100000000,
  finalReturn: 47.3,
  winRate: 68.5,
  totalTrades: 42,
  mdd: -12.4,
  sharpeRatio: 1.85,
};

// Generate realistic equity curve data
const generateEquityCurve = (progress: number) => {
  const points = 60;
  const data = [];
  const startValue = 100000000;
  const endValue = startValue * (1 + backtestConfig.finalReturn / 100);
  
  for (let i = 0; i <= points; i++) {
    const x = i / points;
    if (x <= progress) {
      // Create realistic market movement
      const trend = startValue + (endValue - startValue) * Math.pow(x, 0.9);
      const volatility = startValue * 0.02;
      const wave1 = Math.sin(x * Math.PI * 8) * volatility * 0.5;
      const wave2 = Math.cos(x * Math.PI * 12) * volatility * 0.3;
      const dip = x > 0.3 && x < 0.4 ? -volatility * 2 * Math.sin((x - 0.3) * Math.PI / 0.1) : 0;
      const recovery = x > 0.6 && x < 0.75 ? volatility * 1.5 * Math.sin((x - 0.6) * Math.PI / 0.15) : 0;
      
      const value = trend + wave1 + wave2 + dip + recovery;
      const returnPct = ((value - startValue) / startValue) * 100;
      
      // Generate month label
      const monthIndex = Math.floor(x * 12);
      const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
      
      data.push({
        index: i,
        value: Math.round(value),
        return: returnPct,
        month: months[monthIndex],
      });
    }
  }
  return data;
};

// Sidebar menu items
const sidebarItems = [
  { icon: BarChart3, label: "대시보드", active: true },
  { icon: LineChart, label: "내 전략", active: false },
  { icon: Briefcase, label: "포트폴리오", active: false },
  { icon: Bot, label: "AI 분석", active: false },
  { icon: Settings, label: "설정", active: false },
];

// Trade history mock data
const recentTrades = [
  { type: "BUY", ticker: "NVDA", price: 485.20, change: "+3.2%", time: "14:32" },
  { type: "SELL", ticker: "NVDA", price: 512.80, change: "+5.7%", time: "09:15" },
];

// Animated counter component
function AnimatedValue({ 
  value, 
  prefix = "", 
  suffix = "",
  delay = 0,
  decimals = 1,
}: { 
  value: number; 
  prefix?: string; 
  suffix?: string;
  delay?: number;
  decimals?: number;
}) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => latest.toFixed(decimals));
  const [displayValue, setDisplayValue] = useState("0");

  useEffect(() => {
    const timer = setTimeout(() => {
      const controls = animate(count, value, { 
        duration: 2.5, 
        ease: "easeOut" 
      });
      const unsubscribe = rounded.on("change", (v) => setDisplayValue(v));
      return () => {
        controls.stop();
        unsubscribe();
      };
    }, delay * 1000);
    
    return () => clearTimeout(timer);
  }, [value, count, rounded, delay]);

  return <span>{prefix}{displayValue}{suffix}</span>;
}

// Format currency
function formatCurrency(value: number): string {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)}억`;
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(0)}만`;
  }
  return value.toLocaleString();
}

export function HeroDashboard() {
  const [chartData, setChartData] = useState<Array<{ index: number; value: number; return: number; month: string }>>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTrades, setShowTrades] = useState(false);

  // Start animation on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(true);
      
      const duration = 3000;
      const startTime = Date.now();

      const updateChart = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        setChartData(generateEquityCurve(progress));

        if (progress < 1) {
          requestAnimationFrame(updateChart);
        } else {
          // Show trades after chart completes
          setTimeout(() => setShowTrades(true), 500);
        }
      };

      requestAnimationFrame(updateChart);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ 
        duration: 0.9, 
        ease: [0.16, 1, 0.3, 1],
        delay: 0.5,
      }}
      className="relative w-full max-w-3xl mx-auto"
      style={{ perspective: 1200 }}
    >
      {/* Glow effect behind the window */}
      <div className="absolute -inset-6 bg-gradient-to-br from-primary/30 via-blue-500/20 to-purple-500/20 rounded-3xl blur-3xl opacity-50 animate-pulse" />
      
      {/* Mac OS Window */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl">
        {/* Window Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200/50 dark:border-slate-700/50">
          {/* Traffic lights */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57] shadow-sm hover:brightness-110 transition-all cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-[#FEBC2E] shadow-sm hover:brightness-110 transition-all cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-[#28C840] shadow-sm hover:brightness-110 transition-all cursor-pointer" />
          </div>
          
          {/* Title */}
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <LineChart className="h-4 w-4 text-primary" />
            <span>EcoQuant Dashboard</span>
          </div>
          
          {/* Spacer */}
          <div className="w-14" />
        </div>

        {/* Window Content */}
        <div className="flex min-h-[380px]">
          {/* Sidebar */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="w-14 border-r border-slate-200/50 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-800/50 py-4"
          >
            <div className="flex flex-col items-center gap-2">
              {sidebarItems.map((item, i) => (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.8 + i * 0.05 }}
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                    item.active 
                      ? "bg-primary text-white shadow-md shadow-primary/30" 
                      : "text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                  )}
                  title={item.label}
                >
                  <item.icon className="h-4 w-4" />
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Main Content */}
          <div className="flex-1 p-4 space-y-3 overflow-hidden">
            {/* Strategy Header */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.9 }}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium">
                  <Bot className="h-3 w-3" />
                  {backtestConfig.strategy}
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400">
                  {backtestConfig.ticker}
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3 w-3" />
                {backtestConfig.period}
              </div>
            </motion.div>

            {/* Stats Row */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1 }}
              className="grid grid-cols-4 gap-2"
            >
              {/* Total Return - Highlighted */}
              <div className="col-span-2 p-3 rounded-xl bg-gradient-to-br from-primary to-blue-600 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <TrendingUp className="h-3.5 w-3.5 opacity-80" />
                    <span className="text-[10px] font-medium opacity-80">총 수익률</span>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">
                    <AnimatedValue value={backtestConfig.finalReturn} prefix="+" suffix="%" delay={1.2} />
                  </p>
                  <p className="text-[10px] opacity-70 mt-0.5">
                    {formatCurrency(backtestConfig.initialCapital * (1 + backtestConfig.finalReturn / 100))} 원
                  </p>
                </div>
              </div>

              {/* Win Rate */}
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-800/30">
                <div className="flex items-center gap-1 mb-0.5">
                  <Target className="h-3 w-3 text-green-600 dark:text-green-400" />
                  <span className="text-[10px] text-green-700 dark:text-green-300">승률</span>
                </div>
                <p className="text-lg font-bold text-green-700 dark:text-green-300">
                  <AnimatedValue value={backtestConfig.winRate} suffix="%" delay={1.4} />
                </p>
              </div>

              {/* MDD */}
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/30">
                <div className="flex items-center gap-1 mb-0.5">
                  <Activity className="h-3 w-3 text-red-600 dark:text-red-400" />
                  <span className="text-[10px] text-red-700 dark:text-red-300">MDD</span>
                </div>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">
                  <AnimatedValue value={backtestConfig.mdd} suffix="%" delay={1.5} decimals={1} />
                </p>
              </div>
            </motion.div>

            {/* Chart Section */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.1 }}
              className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                    수익률 곡선
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <Newspaper className="h-3 w-3" />
                    <span>AI 뉴스 분석</span>
                  </div>
                  <span>{backtestConfig.totalTrades}회 거래</span>
                </div>
              </div>
              
              {/* Chart */}
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="heroGradientNew" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3182f6" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#3182f6" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 9, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      hide 
                      domain={['dataMin - 5', 'dataMax + 5']} 
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white dark:bg-slate-800 px-2 py-1.5 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-[10px]">
                              <p className="font-medium text-primary">
                                {data.return > 0 ? '+' : ''}{data.return.toFixed(1)}%
                              </p>
                              <p className="text-slate-500">₩{formatCurrency(data.value)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="return"
                      stroke="#3182f6"
                      strokeWidth={2}
                      fill="url(#heroGradientNew)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Bottom Stats & Trades */}
            <div className="grid grid-cols-2 gap-2">
              {/* Additional Metrics */}
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 1.3 }}
                className="p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">상세 지표</span>
                  <BarChart3 className="h-3 w-3 text-slate-400" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <p className="text-slate-400">샤프 비율</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      <AnimatedValue value={backtestConfig.sharpeRatio} delay={1.6} decimals={2} />
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">총 거래</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      <AnimatedValue value={backtestConfig.totalTrades} delay={1.7} decimals={0} />회
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Recent Trades */}
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 1.4 }}
                className="p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">최근 거래</span>
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                </div>
                <div className="space-y-1.5">
                  {recentTrades.map((trade, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: showTrades ? 1 : 0, x: showTrades ? 0 : 10 }}
                      transition={{ delay: i * 0.15 }}
                      className="flex items-center justify-between text-[10px]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "px-1 py-0.5 rounded text-[8px] font-semibold",
                          trade.type === "BUY" 
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}>
                          {trade.type}
                        </span>
                        <span className="font-medium text-slate-700 dark:text-slate-200">${trade.price}</span>
                      </div>
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-0.5">
                        <ArrowUpRight className="h-2.5 w-2.5" />
                        {trade.change}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 2 }}
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-xl bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg text-xs font-semibold"
      >
        🔥 실시간 데모
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 2.2 }}
        className="absolute -bottom-3 -left-3 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 shadow-lg border border-slate-200/50 dark:border-slate-700/50"
      >
        <div className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-medium text-slate-600 dark:text-slate-300">
            AI 분석 완료
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default HeroDashboard;
