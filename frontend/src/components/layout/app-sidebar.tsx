"use client";

import { useState } from "react";
import {
  BarChart3,
  Bot,
  ChevronUp,
  ExternalLink,
  Folder,
  Home,
  LineChart,
  LogOut,
  Newspaper,
  Plus,
  Settings,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { ComingSoonModal } from "@/components/ui/coming-soon-modal";

interface NavItem {
  title: string;
  icon: React.ElementType;
  href?: string;
  comingSoon?: boolean;
  description?: string;
  alternativeAction?: {
    label: string;
    href: string;
  };
}

const mainNavItems: NavItem[] = [
  {
    title: "대시보드",
    icon: Home,
    href: "/dashboard",
  },
  {
    title: "백테스트",
    icon: LineChart,
    href: "/dashboard/backtest",
  },
  {
    title: "전략 관리",
    icon: Folder,
    href: "/dashboard/strategies",
  },
  {
    title: "뉴스 분석",
    icon: Newspaper,
    comingSoon: true,
    description: "AI가 분석한 금융 뉴스와 감성 점수를 확인할 수 있는 기능입니다.",
    alternativeAction: {
      label: "AI 전략 만들기",
      href: "/dashboard/strategies/new?type=sentiment_sma",
    },
  },
];

const analysisNavItems: NavItem[] = [
  {
    title: "성과 리포트",
    icon: BarChart3,
    comingSoon: true,
    description: "백테스트 결과를 종합한 상세 리포트를 확인할 수 있습니다.",
    alternativeAction: {
      label: "백테스트 실행",
      href: "/dashboard/backtest",
    },
  },
  {
    title: "AI 인사이트",
    icon: Bot,
    comingSoon: true,
    description: "AI가 분석한 투자 인사이트와 추천 전략을 제공합니다.",
    alternativeAction: {
      label: "AI 전략 만들기",
      href: "/dashboard/strategies/new?type=sentiment_sma",
    },
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  
  // Coming soon modal state
  const [comingSoonModal, setComingSoonModal] = useState<{
    isOpen: boolean;
    feature: string;
    description?: string;
    alternativeAction?: { label: string; href: string };
  }>({
    isOpen: false,
    feature: "",
  });

  const openComingSoonModal = (item: NavItem) => {
    setComingSoonModal({
      isOpen: true,
      feature: item.title,
      description: item.description,
      alternativeAction: item.alternativeAction,
    });
  };

  const closeComingSoonModal = () => {
    setComingSoonModal({ ...comingSoonModal, isOpen: false });
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const renderNavItem = (item: NavItem) => {
    if (item.comingSoon) {
      return (
        <SidebarMenuButton
          onClick={() => openComingSoonModal(item)}
          tooltip={item.title}
          className={cn(
            "rounded-xl cursor-pointer",
            "hover:bg-secondary text-muted-foreground hover:text-foreground"
          )}
        >
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
        </SidebarMenuButton>
      );
    }

    // For "/dashboard", only match exactly. For other paths, use startsWith for sub-routes
    const isActive = item.href === "/dashboard" 
      ? pathname === "/dashboard"
      : pathname === item.href || (item.href && pathname.startsWith(item.href + "/"));
    
    return (
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={item.title}
        className={cn(
          "rounded-xl",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-secondary text-muted-foreground hover:text-foreground"
        )}
      >
        <Link href={item.href!}>
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    );
  };

  return (
    <>
      <Sidebar variant="inset" collapsible="icon" className="border-r border-border bg-card">
        <SidebarHeader className="border-b border-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center justify-between w-full">
                <SidebarMenuButton size="lg" asChild className="flex-1">
                  <Link href="/dashboard" className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
                      <LineChart className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-base text-foreground">EcoQuant</span>
                      <span className="text-xs text-muted-foreground">AI Quant Platform</span>
                    </div>
                  </Link>
                </SidebarMenuButton>
                <Link 
                  href="/" 
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="메인 페이지로 이동"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {/* Quick Action */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="새 백테스트"
                    className="bg-primary/10 hover:bg-primary/20 text-primary rounded-xl cursor-pointer"
                    onClick={() => {
                      // If already on backtest page, force refresh with new timestamp
                      if (pathname === "/dashboard/backtest" || pathname.startsWith("/dashboard/backtest?")) {
                        router.push(`/dashboard/backtest?new=${Date.now()}`);
                      } else {
                        router.push("/dashboard/backtest");
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="font-medium">새 백테스트</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              메인 메뉴
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    {renderNavItem(item)}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              분석
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {analysisNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    {renderNavItem(item)}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-secondary hover:bg-secondary rounded-xl"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="" alt="User" />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {user?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-1 flex-col text-left text-sm leading-tight">
                      <span className="font-medium text-foreground truncate">
                        {user?.full_name || "사용자"}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {user?.email || "user@example.com"}
                      </span>
                    </div>
                    <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="start"
                  className="w-[--radix-dropdown-menu-trigger-width] rounded-xl"
                >
                  <DropdownMenuItem 
                    onClick={() => openComingSoonModal({
                      title: "프로필",
                      icon: User,
                      comingSoon: true,
                      description: "프로필 정보를 확인하고 수정할 수 있습니다.",
                    })}
                    className="rounded-lg cursor-pointer"
                  >
                    <User className="mr-2 h-4 w-4" />
                    프로필
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => openComingSoonModal({
                      title: "설정",
                      icon: Settings,
                      comingSoon: true,
                      description: "알림, 테마, API 키 등을 설정할 수 있습니다.",
                    })}
                    className="rounded-lg cursor-pointer"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    설정
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive rounded-lg cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

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
