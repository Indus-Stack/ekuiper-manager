"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { Toaster } from "sonner";
import { useServerStore } from "@/stores/server-store";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme} richColors closeButton position="bottom-left" />;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Initialize Server Store
  const fetchServers = useServerStore((state) => state.fetchServers);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/welcome" && pathname !== "/change-password") {
      void fetchServers();
    }
  }, [fetchServers, pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <TooltipProvider>
            {children}
            <ThemedToaster />
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
