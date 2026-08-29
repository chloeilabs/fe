"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PortfolioProvider } from "@/lib/portfolio/store";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <PortfolioProvider>
        {children}
        <Toaster />
      </PortfolioProvider>
    </TooltipProvider>
  );
}
