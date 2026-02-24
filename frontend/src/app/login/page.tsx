"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LineChart, Loader2 } from "lucide-react";
import { toast, Toaster } from "sonner";
import { AxiosError } from "axios";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthStore } from "@/stores/auth-store";

const REMEMBERED_EMAIL_KEY = "remembered_email";

type Step = "email" | "password";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithCredentials, loginWithGoogle } = useAuthStore();
  const [step, setStep] = useState<Step>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // Load remembered email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (savedEmail) {
      setFormData(prev => ({ ...prev, email: savedEmail }));
      setRememberEmail(true);
    }
  }, []);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      let description = "Google 로그인을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.";
      
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const detail = error.response?.data?.detail;
        
        if (status === 503) {
          description = "Google 로그인이 현재 사용 불가능합니다. 서버에서 Google OAuth가 설정되지 않았습니다.";
        } else if (typeof detail === "string") {
          description = detail;
        }
      }
      
      toast.error("Google 로그인 오류", { description });
      setIsGoogleLoading(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      toast.error("이메일을 입력해주세요");
      return;
    }
    if (!formData.email.includes("@")) {
      toast.error("올바른 이메일 형식을 입력해주세요");
      return;
    }
    
    // Save or remove email based on checkbox
    if (rememberEmail) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, formData.email);
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
    
    setStep("password");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.password) {
      toast.error("비밀번호를 입력해주세요");
      return;
    }

    setIsLoading(true);

    try {
      await loginWithCredentials(formData.email, formData.password);
      toast.success("로그인 성공!", {
        description: "대시보드로 이동합니다.",
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("Login failed:", err);
      
      if (err instanceof AxiosError) {
        const status = err.response?.status;
        const detail = err.response?.data?.detail;

        if (status === 404) {
          toast.error("서버 연결 오류", {
            description: "API 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
          });
        } else if (status === 401) {
          toast.error("로그인 실패", {
            description: "이메일 또는 비밀번호가 올바르지 않습니다.",
          });
        } else if (status === 403) {
          toast.error("계정 비활성화", {
            description: "계정이 비활성화되었습니다. 관리자에게 문의해주세요.",
          });
        } else if (status === 422) {
          toast.error("입력값 오류", {
            description: typeof detail === "string" ? detail : "입력값을 확인해주세요.",
          });
        } else if (status === 500) {
          toast.error("서버 오류", {
            description: "서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
          });
        } else {
          toast.error("로그인 실패", {
            description: detail || "알 수 없는 오류가 발생했습니다.",
          });
        }
      } else {
        toast.error("네트워크 오류", {
          description: "서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    setStep("email");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="h-16 flex items-center px-6 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <LineChart className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-foreground">EcoQuant</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {step === "email" ? (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    안녕하세요 👋
                  </h1>
                  <p className="text-muted-foreground">
                    로그인을 위해 이메일을 입력해주세요
                  </p>
                </div>

                <form onSubmit={handleEmailSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                      이메일
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="you@example.com"
                      autoFocus
                      className="input-clean"
                    />
                  </div>

                  {/* Remember Email Checkbox */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember-email"
                      checked={rememberEmail}
                      onCheckedChange={(checked) => setRememberEmail(checked === true)}
                    />
                    <label
                      htmlFor="remember-email"
                      className="text-sm text-muted-foreground cursor-pointer select-none"
                    >
                      이메일 기억하기
                    </label>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-14 text-lg bg-primary hover:bg-primary/90 text-white rounded-2xl gap-2"
                  >
                    다음
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </form>

                <div className="mt-8 text-center">
                  <p className="text-muted-foreground">
                    아직 계정이 없으신가요?{" "}
                    <Link href="/register" className="text-primary font-medium hover:underline">
                      회원가입
                    </Link>
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="password"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <button
                  onClick={goBack}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  뒤로
                </button>

                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    비밀번호 입력
                  </h1>
                  <p className="text-muted-foreground">
                    <span className="text-primary font-medium">{formData.email}</span> 계정의 비밀번호를 입력해주세요
                  </p>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                      비밀번호
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                        autoFocus
                        className="input-clean pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                      비밀번호를 잊으셨나요?
                    </Link>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-14 text-lg bg-primary hover:bg-primary/90 text-white rounded-2xl gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        로그인 중...
                      </>
                    ) : (
                      "로그인"
                    )}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Social Login */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-background text-muted-foreground">또는</span>
              </div>
            </div>

            <div className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading}
                className="w-full h-14 text-base border-border hover:bg-secondary rounded-2xl gap-3"
              >
                {isGoogleLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Google 연결 중...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Google로 계속하기
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Terms */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            로그인하면{" "}
            <Link href="/terms" className="underline hover:text-foreground">
              이용약관
            </Link>{" "}
            및{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              개인정보처리방침
            </Link>
            에 동의하게 됩니다.
          </p>
        </div>
      </main>
    </div>
  );
}
