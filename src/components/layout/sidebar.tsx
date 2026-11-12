'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Blocks,
  ChevronLeft,
  Database,
  FileArchive,
  FileJson,
  FolderCog,
  FunctionSquare,
  HardDriveUpload,
  Network,
  Plug,
  Server,
  Settings,
  Table2,
  Upload,
  Users,
  Workflow,
  WandSparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { MessageKey } from '@/lib/i18n/translate';
import type { EngineFamily } from '@/lib/engines/types';
import { useServerStore, type ServerConnection } from '@/stores/server-store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface NavItem {
  /** Locale key resolved at render time; never a display string. */
  titleKey: MessageKey;
  href: string;
  icon: ComponentType<{ className?: string }>;
  requiredEngine?: EngineFamily;
  requiredCapability?: string;
}

export function isNavItemSupported(item: NavItem, server: ServerConnection | null): boolean {
  if (!server) return !item.requiredEngine;
  if (item.requiredEngine && server.engineFamily && server.engineFamily !== item.requiredEngine) {
    return false;
  }
  if (item.requiredEngine && !server.engineFamily) {
    return false;
  }
  if (item.requiredCapability && server.capabilities && server.capabilities[item.requiredCapability] === false) {
    return false;
  }
  return true;
}

const ENGINE_SPECIFIC_ROUTES: Array<{
  prefix: string;
  requiredEngine: EngineFamily;
  label: string;
}> = [
  { prefix: '/fleet', requiredEngine: 'rekuiper', label: 'Fleet management' },
  { prefix: '/declarative', requiredEngine: 'rekuiper', label: 'Declarative operations' },
  { prefix: '/diagnostics', requiredEngine: 'rekuiper', label: 'Runtime diagnostics & DLQ' },
];

export function checkRouteSupportForTarget(
  pathname: string,
  server: ServerConnection | null,
): { supported: true } | { supported: false; reason: string } {
  const match = ENGINE_SPECIFIC_ROUTES.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`),
  );
  if (!match) return { supported: true };
  if (!server || server.engineFamily !== match.requiredEngine) {
    const targetName = server?.name ?? 'the current selection';
    const engineName = server?.engineFamily ?? 'unknown engine';
    return {
      supported: false,
      reason: `${match.label} requires a ${match.requiredEngine} target (${targetName} is ${engineName}).`,
    };
  }
  return { supported: true };
}

export interface NavGroup {
  titleKey: MessageKey;
  icon: ComponentType<{ className?: string }>;
  items: NavItem[];
}

export const navigationGroups: NavGroup[] = [
  {
    titleKey: 'nav.groupsWorkspace',
    icon: Activity,
    items: [{ titleKey: 'nav.overview', href: '/dashboard', icon: Activity }],
  },
  {
    titleKey: 'nav.groupsData',
    icon: Database,
    items: [
      { titleKey: 'nav.streams', href: '/streams', icon: Database },
      { titleKey: 'nav.tables', href: '/tables', icon: Table2 },
    ],
  },
  {
    titleKey: 'nav.groupsRules',
    icon: Workflow,
    items: [
      { titleKey: 'nav.flows', href: '/flows', icon: Workflow },
      { titleKey: 'nav.rules', href: '/rules', icon: Workflow },
      { titleKey: 'nav.designer', href: '/rules/new', icon: WandSparkles },
    ],
  },
  {
    titleKey: 'nav.groupsResources',
    icon: FolderCog,
    items: [
      { titleKey: 'nav.connections', href: '/connections', icon: Network },
      { titleKey: 'nav.schemas', href: '/schemas', icon: FileJson },
      { titleKey: 'nav.files', href: '/uploads', icon: HardDriveUpload },
    ],
  },
  {
    titleKey: 'nav.groupsExtensions',
    icon: Blocks,
    items: [
      { titleKey: 'nav.plugins', href: '/plugins', icon: Plug },
      { titleKey: 'nav.functions', href: '/functions', icon: FunctionSquare },
      { titleKey: 'nav.services', href: '/services', icon: Network },
    ],
  },
  {
    titleKey: 'nav.groupsOperations',
    icon: FileArchive,
    items: [
      { titleKey: 'nav.dataImport', href: '/data/import', icon: Upload },
      { titleKey: 'nav.dataExport', href: '/data/export', icon: FileArchive },
    ],
  },
  {
    titleKey: 'nav.groupsManager',
    icon: Settings,
    items: [
      { titleKey: 'nav.nodes', href: '/nodes', icon: Server },
      { titleKey: 'nav.users', href: '/users', icon: Users },
      { titleKey: 'nav.settings', href: '/settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

function active(pathname: string, href: string): boolean {
  if (pathname === '/rules/new') return href === '/rules/new';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ collapsed = false, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const t = useT();
  const activeServer = useServerStore((state) => state.getActiveServer());
  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r bg-background transition-[width]',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-14 items-center border-b px-3">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2" aria-label="eKuiper Manager">
          <Workflow className="size-6 shrink-0 text-primary" aria-hidden="true" />
          {!collapsed && <span className="truncate font-semibold" title="eKuiper Manager">eKuiper Manager</span>}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className={cn('ml-auto size-8', collapsed && 'mx-auto')}
          onClick={() => onCollapsedChange?.(!collapsed)}
          aria-label={collapsed ? t('nav.expandNavigation') : t('nav.collapseNavigation')}
          aria-expanded={!collapsed}
        >
          <ChevronLeft className={cn('size-4 transition-transform', collapsed && 'rotate-180')} aria-hidden="true" />
        </Button>
      </div>
      <ScrollArea className="flex-1 py-3">
        <nav className="flex flex-col gap-4 px-2" aria-label={t('nav.primaryNavigation')}>
          {navigationGroups.map((group) => (
            <div key={group.titleKey}>
              {!collapsed && (
                <p className="mb-1 px-3 text-xs font-semibold text-muted-foreground/80">
                  {t(group.titleKey)}
                </p>
              )}
              <div className="flex flex-col gap-1">
                {group.items
                  .filter((item) => isNavItemSupported(item, activeServer))
                  .map((item) => {
                  const label = t(item.titleKey);
                  const itemButton = (
                    <Button
                      variant={active(pathname, item.href) ? 'secondary' : 'ghost'}
                      size={collapsed ? 'icon' : 'default'}
                      className={cn('h-9', !collapsed && 'w-full justify-start gap-3')}
                      aria-label={collapsed ? label : undefined}
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden="true" />
                      {!collapsed && label}
                    </Button>
                  );
                  return collapsed ? (
                    <Tooltip key={item.href} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link href={item.href} aria-current={active(pathname, item.href) ? 'page' : undefined}>
                          {itemButton}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active(pathname, item.href) ? 'page' : undefined}
                    >
                      {itemButton}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
