"use client";

import { Bell, Home, Moon, Search, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function DashboardHeader() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b border-border bg-card/80 backdrop-blur-lg px-4">
      <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg" />
      <Separator orientation="vertical" className="h-6" />
      
      {/* Home Link */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl"
              >
                <Home className="h-5 w-5" />
                <span className="sr-only">홈으로</span>
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>메인 페이지로 이동</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Search Bar */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="전략, 백테스트 검색..."
          className="w-full h-10 pl-10 pr-4 rounded-xl bg-secondary border-none text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
              <span className="sr-only">알림</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-2xl p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/50">
              <span className="font-medium text-foreground">알림</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-primary hover:text-primary hover:bg-transparent h-auto p-0"
              >
                모두 읽음
              </Button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <DropdownMenuItem className="flex flex-col items-start gap-1 px-4 py-3 hover:bg-secondary/50 focus:bg-secondary/50 cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="font-medium text-sm text-foreground">백테스트 완료</span>
                </div>
                <span className="text-xs text-muted-foreground pl-4">
                  AAPL SMA 전략 백테스트가 완료되었습니다.
                </span>
                <span className="text-xs text-muted-foreground/60 pl-4">2분 전</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1 px-4 py-3 hover:bg-secondary/50 focus:bg-secondary/50 cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="font-medium text-sm text-foreground">뉴스 분석 완료</span>
                </div>
                <span className="text-xs text-muted-foreground pl-4">
                  TSLA 관련 5건의 뉴스 분석이 완료되었습니다.
                </span>
                <span className="text-xs text-muted-foreground/60 pl-4">15분 전</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl"
        >
          {theme === "light" ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
          <span className="sr-only">테마 변경</span>
        </Button>
      </div>
    </header>
  );
}
