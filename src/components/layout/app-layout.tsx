"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar, checkRouteSupportForTarget } from "./sidebar";
import { Header } from "./header";
import { UnifiedSearch } from "@/components/common/unified-search";
import { Assistant } from "@/components/assistant/assistant";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { useServerStore } from "@/stores/server-store";

import { useT } from '@/lib/i18n';
interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const activeServer = useServerStore((state) => state.getActiveServer());
  const routeSupport = checkRouteSupportForTarget(pathname, activeServer);
  const isFlowDesignerRoute = /^\/flows\/[^/]+/.test(pathname);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(isFlowDesignerRoute);
  const [mounted, setMounted] = React.useState(false);
  const [sessionReady, setSessionReady] = React.useState(false);

  React.useEffect(() => {
    if (isFlowDesignerRoute) {
      setSidebarCollapsed(true);
    }
  }, [isFlowDesignerRoute]);

  // Prevent hydration mismatch - wait for client mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/auth/session', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace('/welcome');
          return;
        }
        if (!response.ok) {
          setSessionReady(true);
          return;
        }
        const payload = await response.json();
        if (payload?.user?.mustChangePassword) {
          router.replace('/change-password');
          return;
        }
        setSessionReady(true);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setSessionReady(true);
      });
    return () => controller.abort();
  }, [router]);

  // Show minimal skeleton during hydration to prevent layout shift
  if (!mounted || !sessionReady) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar skeleton - hidden on mobile */}
        <div className="hidden md:block w-64 border-r bg-background shrink-0" />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <div className="h-14 border-b bg-background shrink-0" />
          <main className="flex-1 overflow-auto p-4 md:p-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-beautiful-md focus:ring-2 focus:ring-ring"
      >
        {t('admin.skipToMain')}
      </a>

      {/* Sidebar - Hidden on mobile, visible on md+ screens */}
      <div className="hidden md:block shrink-0">
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header title={title} />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto p-4 md:p-6 focus:outline-none">
          {routeSupport.supported ? (
            children
          ) : (
            <div className="mx-auto mt-12 max-w-lg rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
              <h2 className="text-lg font-semibold">Feature unavailable for selected target</h2>
              <p className="mt-2 text-sm text-muted-foreground">{routeSupport.reason}</p>
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm">
                  <Link href="/dashboard">Back to Overview</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/nodes">Manage Nodes</Link>
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>

      <UnifiedSearch />
      <Assistant pageTitle={title ?? 'eKuiper Manager'} />
    </div>
  );
}
