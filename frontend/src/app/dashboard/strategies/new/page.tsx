"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  LineChart,
  Loader2,
  Settings2,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useCreateStrategy } from "@/hooks/use-strategies";

type Step = 1 | 2 | 3;

interface StrategyType {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  category: "technical" | "ai";
}

const strategyTypes: StrategyType[] = [
  {
    id: "sma_crossover",
    name: "SMA 이동평균선",
    description: "단기/장기 이동평균선 교차 시 매매 신호 발생",
    icon: TrendingUp,
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    category: "technical",
  },
  {
    id: "ema_crossover",
    name: "EMA 지수이동평균선",
    description: "최근 가격에 더 가중치를 둔 이동평균선 전략",
    icon: LineChart,
    iconBg: "bg-cyan-100 dark:bg-cyan-900/30",
    iconColor: "text-cyan-600 dark:text-cyan-400",
    category: "technical",
  },
  {
    id: "sentiment_sma",
    name: "AI 뉴스 심리 전략",
    description: "뉴스 감성 분석 + 이동평균선을 결합한 하이브리드 전략",
    icon: Bot,
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
    category: "ai",
  },
  {
    id: "sentiment_sma_aggressive",
    name: "공격적 AI 전략",
    description: "높은 위험을 감수하며 수익 극대화 추구",
    icon: Sparkles,
    iconBg: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
    category: "ai",
  },
  {
    id: "sentiment_sma_conservative",
    name: "보수적 AI 전략",
    description: "안정성을 중시하는 저위험 전략",
    icon: BarChart3,
    iconBg: "bg-green-100 dark:bg-green-900/30",
    iconColor: "text-green-600 dark:text-green-400",
    category: "ai",
  },
];

const defaultParams = {
  sma_crossover: { 
    fast_period: 10, 
    slow_period: 30,
    // Risk Management (percentage for UI display)
    stop_loss: 0,
    take_profit: 0,
    // Position Sizing (percentage for UI, will be converted to 0-1 for backend)
    position_size: 100, // 100% = 1.0 in backend
  },
  ema_crossover: { 
    fast_period: 10, 
    slow_period: 30, 
    use_ema: true,
    stop_loss: 0,
    take_profit: 0,
    position_size: 100,
  },
  sentiment_sma: { 
    fast_period: 10, 
    slow_period: 30, 
    buy_threshold: 0.2, 
    panic_threshold: -0.5, 
    sentiment_lookback: 3,
    // Risk Management
    stop_loss: 5,
    take_profit: 10,
    // Position Sizing
    position_size: 100,
    // AI Sensitivity
    ai_weight: 0.5,
    ignore_ai_on_strong_signal: false,
  },
  sentiment_sma_aggressive: { 
    fast_period: 5, 
    slow_period: 20, 
    buy_threshold: 0.1, 
    panic_threshold: -0.3, 
    sentiment_lookback: 2,
    stop_loss: 3,
    take_profit: 15,
    position_size: 100,
    ai_weight: 0.3,
    ignore_ai_on_strong_signal: true,
  },
  sentiment_sma_conservative: { 
    fast_period: 15, 
    slow_period: 50, 
    buy_threshold: 0.4, 
    panic_threshold: -0.7, 
    sentiment_lookback: 5,
    stop_loss: 7,
    take_profit: 8,
    position_size: 50,
    ai_weight: 0.7,
    ignore_ai_on_strong_signal: false,
  },
};

export default function NewStrategyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createStrategy = useCreateStrategy();

  const [step, setStep] = useState<Step>(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [strategyName, setStrategyName] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [params, setParams] = useState({
    // Basic MA params
    fast_period: 10,
    slow_period: 30,
    use_ema: false,
    // AI params
    buy_threshold: 0.2,
    panic_threshold: -0.5,
    sentiment_lookback: 3,
    // Risk Management
    stop_loss: 0,
    take_profit: 0,
    // Position Sizing
    position_size: 100,
    // AI Sensitivity
    ai_weight: 0.5,
    ignore_ai_on_strong_signal: false,
  });

  // URL에서 전략 타입 가져오기
  useEffect(() => {
    const type = searchParams.get("type");
    if (type && strategyTypes.find(s => s.id === type)) {
      setSelectedType(type);
      const typeDefaults = defaultParams[type as keyof typeof defaultParams];
      if (typeDefaults) {
        setParams(prev => ({ ...prev, ...typeDefaults }));
      }
    }
  }, [searchParams]);

  const selectedStrategy = strategyTypes.find(s => s.id === selectedType);
  const isAiStrategy = selectedStrategy?.category === "ai";

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId);
    const typeDefaults = defaultParams[typeId as keyof typeof defaultParams];
    if (typeDefaults) {
      setParams(prev => ({ ...prev, ...typeDefaults }));
    }
  };

  const handleNext = () => {
    if (step === 1 && !selectedType) {
      toast.error("전략 유형을 선택해주세요");
      return;
    }
    if (step === 2 && params.fast_period >= params.slow_period) {
      toast.error("단기 기간은 장기 기간보다 작아야 합니다");
      return;
    }
    setStep((prev) => Math.min(prev + 1, 3) as Step);
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1) as Step);
  };

  const handleSubmit = async () => {
    if (!strategyName.trim()) {
      toast.error("전략 이름을 입력해주세요");
      return;
    }

    try {
      // Convert position_size from percentage (0-100) to fraction (0-1) for backend
      const backendParams = {
        ...params,
        position_size: params.position_size / 100, // 100% -> 1.0, 50% -> 0.5
      };

      await createStrategy.mutateAsync({
        name: strategyName,
        description: selectedStrategy?.description,
        strategy_type: selectedType!.toLowerCase(), // Backend expects lowercase enum values
        logic_config: backendParams,
      });
      router.push("/dashboard");
    } catch {
      // Error handled by mutation
    }
  };

  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: -20 },
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          뒤로
        </button>
        <h1 className="text-3xl font-bold text-foreground">새 전략 만들기</h1>
        <p className="text-muted-foreground mt-1">
          단계별로 쉽게 투자 전략을 설정하세요
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "flex items-center justify-center h-10 w-10 rounded-full text-sm font-medium transition-colors",
                step >= s
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {step > s ? <Check className="h-5 w-5" /> : s}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                step >= s ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>유형 선택</span>
          <span>파라미터 설정</span>
          <span>저장</span>
        </div>
      </div>

      {/* Steps Content */}
      <AnimatePresence mode="wait">
        {/* Step 1: Type Selection */}
        {step === 1 && (
          <motion.div
            key="step1"
            variants={pageVariants}
            initial="initial"
            animate="in"
            exit="out"
            transition={{ duration: 0.3 }}
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                전략 유형을 선택하세요
              </h2>
              <p className="text-muted-foreground">
                기술적 분석 또는 AI 기반 전략 중 선택하세요
              </p>
            </div>

            {/* Technical Analysis */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                기술적 분석
              </h3>
              <div className="grid gap-3">
                {strategyTypes
                  .filter((s) => s.category === "technical")
                  .map((type) => (
                    <button
                      key={type.id}
                      onClick={() => handleTypeSelect(type.id)}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                        selectedType === type.id
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-secondary/50 hover:bg-secondary"
                      )}
                    >
                      <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl", type.iconBg)}>
                        <type.icon className={cn("h-7 w-7", type.iconColor)} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{type.name}</p>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      </div>
                      {selectedType === type.id && (
                        <Check className="h-6 w-6 text-primary" />
                      )}
                    </button>
                  ))}
              </div>
            </div>

            {/* AI Strategies */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Bot className="h-4 w-4" />
                AI 뉴스 심리 분석
              </h3>
              <div className="grid gap-3">
                {strategyTypes
                  .filter((s) => s.category === "ai")
                  .map((type) => (
                    <button
                      key={type.id}
                      onClick={() => handleTypeSelect(type.id)}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                        selectedType === type.id
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-secondary/50 hover:bg-secondary"
                      )}
                    >
                      <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl", type.iconBg)}>
                        <type.icon className={cn("h-7 w-7", type.iconColor)} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{type.name}</p>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      </div>
                      {selectedType === type.id && (
                        <Check className="h-6 w-6 text-primary" />
                      )}
                    </button>
                  ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Parameters */}
        {step === 2 && (
          <motion.div
            key="step2"
            variants={pageVariants}
            initial="initial"
            animate="in"
            exit="out"
            transition={{ duration: 0.3 }}
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                파라미터 설정
              </h2>
              <p className="text-muted-foreground">
                {selectedStrategy?.name} 전략의 세부 설정을 조정하세요
              </p>
            </div>

            <div className="space-y-8 card-elevated p-6">
              {/* Moving Average Periods */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-base font-medium">단기 이동평균 기간</Label>
                    <span className="text-2xl font-bold text-primary">{params.fast_period}일</span>
                  </div>
                  <Slider
                    value={[params.fast_period]}
                    onValueChange={([value]) => setParams({ ...params, fast_period: value })}
                    min={3}
                    max={50}
                    step={1}
                    className="py-4"
                  />
                  <p className="text-xs text-muted-foreground">
                    짧을수록 민감하게 반응, 길수록 안정적
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-base font-medium">장기 이동평균 기간</Label>
                    <span className="text-2xl font-bold text-primary">{params.slow_period}일</span>
                  </div>
                  <Slider
                    value={[params.slow_period]}
                    onValueChange={([value]) => setParams({ ...params, slow_period: value })}
                    min={10}
                    max={200}
                    step={5}
                    className="py-4"
                  />
                  <p className="text-xs text-muted-foreground">
                    장기 추세를 파악하는 기준선
                  </p>
                </div>
              </div>

              {/* AI Strategy Specific Params */}
              {isAiStrategy && (
                <>
                  <div className="border-t pt-6">
                    <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      AI 감성 분석 설정
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-base font-medium">매수 임계값</Label>
                          <span className="text-2xl font-bold text-green-600">{params.buy_threshold.toFixed(1)}</span>
                        </div>
                        <Slider
                          value={[params.buy_threshold * 10]}
                          onValueChange={([value]) => setParams({ ...params, buy_threshold: value / 10 })}
                          min={0}
                          max={9}
                          step={1}
                          className="py-4"
                        />
                        <p className="text-xs text-muted-foreground">
                          뉴스 감성 점수가 이 값 이상일 때만 매수 (-1~1 범위)
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-base font-medium">패닉셀 임계값</Label>
                          <span className="text-2xl font-bold text-red-500">{params.panic_threshold.toFixed(1)}</span>
                        </div>
                        <Slider
                          value={[(params.panic_threshold + 1) * 5]}
                          onValueChange={([value]) => setParams({ ...params, panic_threshold: value / 5 - 1 })}
                          min={0}
                          max={9}
                          step={1}
                          className="py-4"
                        />
                        <p className="text-xs text-muted-foreground">
                          뉴스 감성 점수가 이 값 이하로 급락하면 즉시 매도
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-base font-medium">감성 분석 기간</Label>
                          <span className="text-2xl font-bold text-primary">{params.sentiment_lookback}일</span>
                        </div>
                        <Slider
                          value={[params.sentiment_lookback]}
                          onValueChange={([value]) => setParams({ ...params, sentiment_lookback: value })}
                          min={1}
                          max={14}
                          step={1}
                          className="py-4"
                        />
                        <p className="text-xs text-muted-foreground">
                          최근 N일간의 뉴스 감성 점수 평균 사용
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Advanced Settings - Collapsible */}
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="border-t pt-6">
                <CollapsibleTrigger className="flex items-center justify-between w-full text-left group">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">고급 설정</span>
                  </div>
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    advancedOpen && "rotate-180"
                  )} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-6 space-y-6">
                  {/* Risk Management */}
                  <div className="p-4 rounded-xl bg-secondary/50 space-y-4">
                    <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Shield className="h-4 w-4 text-orange-500" />
                      리스크 관리
                    </h4>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm">손절가 (Stop Loss)</Label>
                        <span className="text-lg font-bold text-red-500">
                          {params.stop_loss === 0 ? "미설정" : `-${params.stop_loss}%`}
                        </span>
                      </div>
                      <Slider
                        value={[params.stop_loss]}
                        onValueChange={([value]) => setParams({ ...params, stop_loss: value })}
                        min={0}
                        max={30}
                        step={1}
                        className="py-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        손실이 이 비율에 도달하면 자동으로 매도 (0 = 미사용)
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm">익절가 (Take Profit)</Label>
                        <span className="text-lg font-bold text-green-600">
                          {params.take_profit === 0 ? "미설정" : `+${params.take_profit}%`}
                        </span>
                      </div>
                      <Slider
                        value={[params.take_profit]}
                        onValueChange={([value]) => setParams({ ...params, take_profit: value })}
                        min={0}
                        max={50}
                        step={1}
                        className="py-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        수익이 이 비율에 도달하면 자동으로 매도 (0 = 미사용)
                      </p>
                    </div>
                  </div>

                  {/* Position Sizing */}
                  <div className="p-4 rounded-xl bg-secondary/50 space-y-4">
                    <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-blue-500" />
                      포지션 사이징
                    </h4>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm">1회 거래 비중</Label>
                        <span className="text-lg font-bold text-primary">{params.position_size}%</span>
                      </div>
                      <Slider
                        value={[params.position_size]}
                        onValueChange={([value]) => setParams({ ...params, position_size: value })}
                        min={10}
                        max={100}
                        step={10}
                        className="py-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        한 번의 매수에 사용할 자산 비중 (분산 투자 시 낮게 설정)
                      </p>
                    </div>
                  </div>

                  {/* AI Sensitivity (AI strategies only) */}
                  {isAiStrategy && (
                    <div className="p-4 rounded-xl bg-secondary/50 space-y-4">
                      <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Target className="h-4 w-4 text-purple-500" />
                        AI 민감도 설정
                      </h4>
                      
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm">AI 신뢰도 가중치</Label>
                          <span className="text-lg font-bold text-purple-600">{(params.ai_weight * 100).toFixed(0)}%</span>
                        </div>
                        <Slider
                          value={[params.ai_weight * 100]}
                          onValueChange={([value]) => setParams({ ...params, ai_weight: value / 100 })}
                          min={10}
                          max={100}
                          step={10}
                          className="py-2"
                        />
                        <p className="text-xs text-muted-foreground">
                          AI 분석 결과에 얼마나 의존할지 설정 (낮으면 기술적 분석 위주)
                        </p>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-background">
                        <div className="flex-1">
                          <Label className="text-sm">강한 신호 시 AI 무시</Label>
                          <p className="text-xs text-muted-foreground">
                            기술적 분석 신호가 매우 강할 때 AI 점수가 낮아도 진입
                          </p>
                        </div>
                        <Switch
                          checked={params.ignore_ai_on_strong_signal}
                          onCheckedChange={(checked) => 
                            setParams({ ...params, ignore_ai_on_strong_signal: checked })
                          }
                        />
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </motion.div>
        )}

        {/* Step 3: Save */}
        {step === 3 && (
          <motion.div
            key="step3"
            variants={pageVariants}
            initial="initial"
            animate="in"
            exit="out"
            transition={{ duration: 0.3 }}
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                전략 저장
              </h2>
              <p className="text-muted-foreground">
                전략에 이름을 붙이고 저장하세요
              </p>
            </div>

            <div className="card-elevated p-6 space-y-6">
              <div>
                <Label htmlFor="name" className="text-base font-medium mb-2 block">
                  전략 이름
                </Label>
                <Input
                  id="name"
                  placeholder="예: 내 첫 번째 AI 전략"
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                  className="h-14 text-lg rounded-xl"
                />
              </div>

              {/* Summary */}
              <div className="p-4 rounded-xl bg-secondary/50">
                <h3 className="font-medium text-foreground mb-3">전략 요약</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">전략 유형</span>
                    <span className="font-medium text-foreground">{selectedStrategy?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">단기 이평선</span>
                    <span className="font-medium text-foreground">{params.fast_period}일</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">장기 이평선</span>
                    <span className="font-medium text-foreground">{params.slow_period}일</span>
                  </div>
                  {isAiStrategy && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">매수 임계값</span>
                        <span className="font-medium text-green-600">{params.buy_threshold.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">패닉셀 임계값</span>
                        <span className="font-medium text-red-500">{params.panic_threshold.toFixed(1)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Advanced Settings Summary */}
                {(params.stop_loss > 0 || params.take_profit > 0 || params.position_size < 100) && (
                  <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
                    <p className="text-xs text-muted-foreground font-medium mb-2">고급 설정</p>
                    {params.stop_loss > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">손절가</span>
                        <span className="font-medium text-red-500">-{params.stop_loss}%</span>
                      </div>
                    )}
                    {params.take_profit > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">익절가</span>
                        <span className="font-medium text-green-600">+{params.take_profit}%</span>
                      </div>
                    )}
                    {params.position_size < 100 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">거래 비중</span>
                        <span className="font-medium text-primary">{params.position_size}%</span>
                      </div>
                    )}
                    {isAiStrategy && params.ai_weight !== 0.5 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">AI 가중치</span>
                        <span className="font-medium text-purple-600">{(params.ai_weight * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 1}
          className="rounded-xl gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          이전
        </Button>

        {step < 3 ? (
          <Button
            onClick={handleNext}
            disabled={step === 1 && !selectedType}
            className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-2"
          >
            다음
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={createStrategy.isPending || !strategyName.trim()}
            className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-2"
          >
            {createStrategy.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                전략 저장
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

