'use client';

import Link from 'next/link';
import { Check, ChevronDown, Plus, Server } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { useServerStore } from '@/stores/server-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ServerSelector() {
  const t = useT();
  const { servers, activeServerId, setActiveServer } = useServerStore();
  const active = servers.find((node) => node.id === activeServerId);
  const activeEngineLabel =
    active?.engineFamily === 'rekuiper'
      ? 'reKuiper'
      : active?.engineFamily === 'ekuiper'
        ? 'eKuiper'
        : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="max-w-[140px] sm:max-w-[260px] md:max-w-[320px] gap-1.5 px-2.5 sm:gap-2 sm:px-4 touch-manipulation" aria-label={t('layout.selectNodeButton')}>
          <Server className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate" title={active?.name ?? t('layout.selectNode')}>{active?.name ?? t('layout.selectNode')}</span>
          {activeEngineLabel && (
            <Badge variant="outline" className="hidden font-normal md:inline-flex">
              {activeEngineLabel}
            </Badge>
          )}
          {active?.version && (
            <Badge variant="secondary" className="hidden font-normal lg:inline-flex">
              {active.version}
            </Badge>
          )}
          {active?.operationMode === 'declarative' && (
            <Badge variant="secondary" className="hidden font-normal xl:inline-flex">
              Declarative
            </Badge>
          )}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel>Registered engine nodes</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {servers.map((node) => {
            const familyLabel =
              node.engineFamily === 'rekuiper'
                ? 'reKuiper'
                : node.engineFamily === 'ekuiper'
                  ? 'eKuiper'
                  : 'Engine';
            const subtext = node.authorizationState === 'auth_required'
              ? `${familyLabel} • Auth required`
              : node.version
                ? `${familyLabel} ${node.version}`
                : t('layout.versionNotDetected');
            return (
              <DropdownMenuItem
                key={node.id}
                onSelect={() => setActiveServer(node.id)}
                className="flex items-start gap-3 py-2"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    node.status === 'connected'
                      ? 'bg-emerald-500'
                      : node.status === 'error'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium" title={node.name}>
                    {node.name}
                    <span className="sr-only">
                      {node.status === 'connected' ? ' (Connected)' : node.status === 'error' ? ' (Error)' : ' (Disconnected)'}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground" title={subtext}>
                    {subtext}
                  </span>
                </span>
                {node.id === activeServerId && <Check className="mt-1 size-4 text-primary" aria-hidden="true" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        {!servers.length && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No eKuiper node is configured.
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/nodes">
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Manage nodes
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
