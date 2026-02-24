"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, LineChart } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { AxiosError } from "axios";

type Status = "loading" | "success" | "error";

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTokens, fetchUser } = useAuthStore();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const error = searchParams.get("error");

      if (error) {
        setStatus("error");
        setErrorMessage(
          error === "access_denied"
            ? "Google 로그인이 취소되었습니다."
            : `Google 로그인 오류: ${error}`
        );
        return;
      }

      if (!code) {
        setStatus("error");
        setErrorMessage("인증 코드가 없습니다.");
        return;
      }

      try {
        // Exchange code for tokens
        const redirectUri = window.location.origin + "/auth/google/callback";
        const tokenResponse = await api.auth.googleCallback(code, redirectUri);

        const { access_token, refresh_token } = tokenResponse;

        // Save tokens
        setTokens(access_token, refresh_token);

        // Fetch user info
        await fetchUser();

        setStatus("success");
        toast.success("Google 로그인 성공!", {
          description: "대시보드로 이동합니다.",
        });

        // Redirect to dashboard after a brief delay
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      } catch (err: unknown) {
        console.error("Google OAuth error:", err);
        setStatus("error");
        
        if (err instanceof AxiosError) {
          setErrorMessage(
            err.response?.data?.detail || "Google 로그인 중 오류가 발생했습니다."
          );
        } else {
          setErrorMessage("Google 로그인 중 오류가 발생했습니다.");
        }
      }
    };

    handleCallback();
  }, [searchParams, setTokens, fetchUser, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
        <div className="w-full max-w-md text-center">
          {status === "loading" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex justify-center">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-primary animate-pulse" />
                  </div>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  로그인 처리 중...
                </h1>
                <p className="text-muted-foreground">
                  Google 계정 정보를 확인하고 있습니다.
                </p>
              </div>
            </motion.div>
          )}

          {status === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  로그인 성공!
                </h1>
                <p className="text-muted-foreground">
                  대시보드로 이동합니다...
                </p>
              </div>
            </motion.div>
          )}

          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  로그인 실패
                </h1>
                <p className="text-muted-foreground mb-6">{errorMessage}</p>
              </div>
              <div className="flex flex-col gap-3">
                <Link href="/login">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-12">
                    다시 로그인하기
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="w-full rounded-xl h-12">
                    홈으로 돌아가기
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}

