"use client";

import { motion, AnimatePresence } from "framer-motion";
import { 
  Construction, 
  X, 
  Sparkles, 
  ArrowRight,
  Bot,
  Newspaper,
  Settings,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  description?: string;
  alternativeAction?: {
    label: string;
    href: string;
  };
}

const featureIcons: Record<string, React.ElementType> = {
  "뉴스 분석": Newspaper,
  "AI 분석": Bot,
  "설정": Settings,
  "알림": Bell,
};

export function ComingSoonModal({
  isOpen,
  onClose,
  feature,
  description,
  alternativeAction,
}: ComingSoonModalProps) {
  const Icon = featureIcons[feature] || Construction;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {/* Header with gradient */}
              <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 pb-6">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>

                <div className="flex flex-col items-center text-center">
                  {/* Icon */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: "spring", damping: 10 }}
                    className="relative mb-6"
                  >
                    <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-600">
                      <Icon className="h-10 w-10 text-white" />
                    </div>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="absolute -top-1 -right-1"
                    >
                      <Sparkles className="h-6 w-6 text-yellow-500" />
                    </motion.div>
                  </motion.div>

                  {/* Title */}
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    {feature}
                  </h2>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
                    <Construction className="h-4 w-4" />
                    준비 중인 기능입니다
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 pt-0">
                <p className="text-center text-muted-foreground mb-6">
                  {description || 
                    `${feature} 기능은 현재 열심히 개발 중입니다. 조금만 기다려주세요!`}
                </p>

                {/* Progress indicator */}
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">개발 진행률</span>
                    <span className="font-medium text-primary">75%</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "75%" }}
                      transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  {alternativeAction && (
                    <Link href={alternativeAction.href} onClick={onClose}>
                      <Button className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-12 gap-2">
                        {alternativeAction.label}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="w-full rounded-xl h-12"
                  >
                    확인
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}



