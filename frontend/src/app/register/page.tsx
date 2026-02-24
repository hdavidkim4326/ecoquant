"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LineChart,
  Loader2,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { AxiosError } from "axios";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";

type Step = "email" | "password" | "name";

interface PasswordValidation {
  minLength: boolean;
  hasLetter: boolean;
  hasDigit: boolean;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function RegisterPage() {
  const router = useRouter();
  const { register, loginWithGoogle } = useAuthStore();
  const [step, setStep] = useState<Step>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  // Email validation state
  const [emailStatus, setEmailStatus] = useState<{
    checking: boolean;
    exists: boolean | null;
    error: string | null;
  }>({
    checking: false,
    exists: null,
    error: null,
  });

  const debouncedEmail = useDebounce(formData.email, 500);

  // Check email availability when email changes
  const checkEmailAvailability = useCallback(async (email: string) => {
    if (!email || !email.includes("@")) {
      setEmailStatus({ checking: false, exists: null, error: null });
      return;
    }

    setEmailStatus({ checking: true, exists: null, error: null });

    try {
      // Try to register with a dummy password to check if email exists
      // This is a workaround since we don't have a dedicated email check endpoint
      const result = await api.auth.checkEmail(email);
      setEmailStatus({ checking: false, exists: result.exists, error: null });
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 409) {
        setEmailStatus({ checking: false, exists: true, error: "이미 사용 중인 이메일입니다" });
      } else {
        // Endpoint doesn't exist or other error, assume email is available
        setEmailStatus({ checking: false, exists: false, error: null });
      }
    }
  }, []);

  useEffect(() => {
    if (debouncedEmail && debouncedEmail.includes("@")) {
      checkEmailAvailability(debouncedEmail);
    }
  }, [debouncedEmail, checkEmailAvailability]);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      toast.error("Google 로그인 오류", {
        description: "Google 로그인을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.",
      });
      setIsGoogleLoading(false);
    }
  };

  // Password validation state
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation>({
    minLength: false,
    hasLetter: false,
    hasDigit: false,
  });

  const validatePassword = (password: string): PasswordValidation => {
    return {
      minLength: password.length >= 8,
      hasLetter: /[a-zA-Z]/.test(password),
      hasDigit: /\d/.test(password),
    };
  };

  const handlePasswordChange = (value: string) => {
    setFormData({ ...formData, password: value });
    setPasswordValidation(validatePassword(value));
  };

  const isPasswordValid = () => {
    return (
      passwordValidation.minLength &&
      passwordValidation.hasLetter &&
      passwordValidation.hasDigit
    );
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
    setStep("password");
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.password) {
      toast.error("비밀번호를 입력해주세요");
      return;
    }
    if (!isPasswordValid()) {
      toast.error("비밀번호 요구사항을 모두 충족해주세요");
      return;
    }
    setStep("name");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await register(formData.email, formData.password, formData.fullName || undefined);
      toast.success("회원가입 성공!", {
        description: "대시보드로 이동합니다.",
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("Registration failed:", err);
      
      if (err instanceof AxiosError) {
        const status = err.response?.status;
        const detail = err.response?.data?.detail;

        if (status === 404) {
          toast.error("서버 연결 오류", {
            description: "API 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
          });
        } else if (status === 409) {
          toast.error("이미 사용 중인 이메일입니다", {
            description: "다른 이메일을 사용하거나 로그인해주세요.",
          });
        } else if (status === 422) {
          // Validation error from backend
          let errorMessage = "입력값을 확인해주세요.";
          if (Array.isArray(detail)) {
            const fieldErrors = detail.map((d: { loc?: string[]; msg?: string }) => {
              const field = d.loc?.[1] || "필드";
              return `${field}: ${d.msg}`;
            });
            errorMessage = fieldErrors.join(", ");
          } else if (typeof detail === "string") {
            errorMessage = detail;
          }
          toast.error("입력값 오류", {
            description: errorMessage,
          });
        } else if (status === 500) {
          toast.error("서버 오류", {
            description: "서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
          });
        } else {
          toast.error("회원가입 실패", {
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
    if (step === "password") {
      setStep("email");
    } else if (step === "name") {
      setStep("password");
    }
  };

  const ValidationItem = ({
    isValid,
    text,
  }: {
    isValid: boolean;
    text: string;
  }) => (
    <div className="flex items-center gap-2 text-sm">
      {isValid ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={isValid ? "text-green-600" : "text-muted-foreground"}>
        {text}
      </span>
    </div>
  );

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

      {/* Progress Indicator */}
      <div className="px-6 pt-8 pb-4 max-w-md mx-auto w-full">
        <div className="flex gap-2">
          <div
            className={`h-1 flex-1 rounded-full transition-colors ${
              step === "email" || step === "password" || step === "name"
                ? "bg-primary"
                : "bg-muted"
            }`}
          />
          <div
            className={`h-1 flex-1 rounded-full transition-colors ${
              step === "password" || step === "name" ? "bg-primary" : "bg-muted"
            }`}
          />
          <div
            className={`h-1 flex-1 rounded-full transition-colors ${
              step === "name" ? "bg-primary" : "bg-muted"
            }`}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {/* Step 1: Email */}
            {step === "email" && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    회원가입 👋
                  </h1>
                  <p className="text-muted-foreground">
                    이메일로 시작해볼까요?
                  </p>
                </div>

                <form onSubmit={handleEmailSubmit} className="space-y-6">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      이메일
                    </label>
                    <div className="relative">
                      <input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="you@example.com"
                        autoFocus
                        className={`input-clean pr-12 ${
                          emailStatus.exists === true
                            ? "border-red-500 focus:ring-red-500"
                            : emailStatus.exists === false && formData.email.includes("@")
                            ? "border-green-500 focus:ring-green-500"
                            : ""
                        }`}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {emailStatus.checking && (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        )}
                        {!emailStatus.checking && emailStatus.exists === true && (
                          <X className="h-5 w-5 text-red-500" />
                        )}
                        {!emailStatus.checking && emailStatus.exists === false && formData.email.includes("@") && (
                          <Check className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                    </div>
                    {/* Email status message */}
                    {emailStatus.exists === true && (
                      <div className="flex items-center gap-2 mt-2 text-red-500 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <span>이미 사용 중인 이메일입니다. <Link href="/login" className="underline font-medium">로그인</Link>하시겠습니까?</span>
                      </div>
                    )}
                    {emailStatus.exists === false && formData.email.includes("@") && !emailStatus.checking && (
                      <div className="flex items-center gap-2 mt-2 text-green-600 text-sm">
                        <Check className="h-4 w-4" />
                        <span>사용 가능한 이메일입니다</span>
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={emailStatus.checking || emailStatus.exists === true}
                    className="w-full h-14 text-lg bg-primary hover:bg-primary/90 text-white rounded-2xl gap-2 disabled:opacity-50"
                  >
                    {emailStatus.checking ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        확인 중...
                      </>
                    ) : (
                      <>
                        다음
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </Button>
                </form>

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
                          Google로 시작하기
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <p className="text-muted-foreground">
                    이미 계정이 있으신가요?{" "}
                    <Link
                      href="/login"
                      className="text-primary font-medium hover:underline"
                    >
                      로그인
                    </Link>
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 2: Password */}
            {step === "password" && (
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
                    비밀번호 설정
                  </h1>
                  <p className="text-muted-foreground">
                    안전한 비밀번호를 설정해주세요
                  </p>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-6">
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      비밀번호
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => handlePasswordChange(e.target.value)}
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

                  {/* Password Requirements */}
                  <div className="p-4 bg-muted/50 rounded-xl space-y-2">
                    <p className="text-sm font-medium text-foreground mb-3">
                      비밀번호 요구사항
                    </p>
                    <ValidationItem
                      isValid={passwordValidation.minLength}
                      text="최소 8자 이상"
                    />
                    <ValidationItem
                      isValid={passwordValidation.hasLetter}
                      text="영문자 포함"
                    />
                    <ValidationItem
                      isValid={passwordValidation.hasDigit}
                      text="숫자 포함"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={!isPasswordValid()}
                    className="w-full h-14 text-lg bg-primary hover:bg-primary/90 text-white rounded-2xl gap-2 disabled:opacity-50"
                  >
                    다음
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </form>
              </motion.div>
            )}

            {/* Step 3: Name */}
            {step === "name" && (
              <motion.div
                key="name"
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
                    마지막 단계!
                  </h1>
                  <p className="text-muted-foreground">
                    어떻게 불러드릴까요? (선택사항)
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-6">
                  <div>
                    <label
                      htmlFor="fullName"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      이름 <span className="text-muted-foreground">(선택)</span>
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData({ ...formData, fullName: e.target.value })
                      }
                      placeholder="홍길동"
                      autoFocus
                      className="input-clean"
                    />
                  </div>

                  {/* Summary */}
                  <div className="p-4 bg-muted/50 rounded-xl space-y-2">
                    <p className="text-sm font-medium text-foreground mb-3">
                      가입 정보 확인
                    </p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">이메일</span>
                      <span className="text-foreground font-medium">
                        {formData.email}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-14 text-lg bg-primary hover:bg-primary/90 text-white rounded-2xl gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        가입 중...
                      </>
                    ) : (
                      <>
                        가입 완료
                        <Check className="h-5 w-5" />
                      </>
                    )}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Terms */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            가입하면{" "}
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

