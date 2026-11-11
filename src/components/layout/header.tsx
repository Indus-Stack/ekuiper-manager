'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Globe, LogOut, Monitor, Moon, Settings, Sun, UserRound } from 'lucide-react';
import { ServerSelector } from './server-selector';
import { MobileNav } from './mobile-nav';
import { LOCALES, LOCALE_LABELS, useI18n, type Locale } from '@/lib/i18n';
import { THEMES, isTheme, useTheme, type Theme } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  title?: string;
}

interface SessionUser {
  username: string;
  role: 'OWNER' | 'USER';
}

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;
const THEME_LABEL_KEYS = {
  light: 'admin.light',
  dark: 'admin.dark',
  system: 'admin.systemTheme',
} as const;
const DESKTOP_HEADER_QUERY = '(min-width: 640px)';

function ThemeRadioItems({
  theme,
  onSelectTheme,
}: {
  theme: Theme;
  onSelectTheme: (theme: Theme) => void;
}) {
  const { t } = useI18n();
  return (
    <DropdownMenuRadioGroup
      value={theme}
      onValueChange={(value) => {
        if (isTheme(value)) onSelectTheme(value);
      }}
    >
      {THEMES.map((option: Theme) => {
        const Icon = THEME_ICONS[option];
        return (
          <DropdownMenuRadioItem key={option} value={option} className="cursor-pointer">
            <Icon className="mr-2 size-4" aria-hidden="true" />
            {t(THEME_LABEL_KEYS[option])}
          </DropdownMenuRadioItem>
        );
      })}
    </DropdownMenuRadioGroup>
  );
}

export function Header({ title }: HeaderProps) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [isMobileHeader, setIsMobileHeader] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setUser(payload?.user ?? null));
  }, []);

  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DESKTOP_HEADER_QUERY);
    const update = () => setIsMobileHeader(!query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/welcome');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-background/80 backdrop-blur-md px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <MobileNav />
        <h1 className="truncate text-base font-semibold md:text-lg" title={title ?? 'eKuiper Manager'}>{title ?? 'eKuiper Manager'}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <ServerSelector />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('common.language')}>
              <Globe className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel>{t('common.language')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {LOCALES.map((option: Locale) => (
              <DropdownMenuItem key={option} onSelect={() => setLocale(option)}>
                <Check
                  className={`mr-2 size-4 ${option === locale ? 'opacity-100' : 'opacity-0'}`}
                  aria-hidden="true"
                />
                {LOCALE_LABELS[option]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label={t('admin.theme')}>
              {resolvedTheme === 'dark' ? (
                <Moon className="size-4" aria-hidden="true" />
              ) : (
                <Sun className="size-4" aria-hidden="true" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel>{t('admin.theme')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ThemeRadioItems theme={theme} onSelectTheme={setTheme} />
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('layout.accountMenu')}>
              <UserRound className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="block truncate" title={user?.username ?? ''}>{user?.username ?? ''}</span>
              {user && (
                <span className="text-xs font-normal text-muted-foreground">
                  {user.role === 'OWNER' ? t('layout.owner') : t('layout.user')}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 size-4" aria-hidden="true" /> {t('nav.settings')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={logout}>
                <LogOut className="mr-2 size-4" aria-hidden="true" /> {t('layout.signOut')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {isMobileHeader && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t('admin.theme')}</DropdownMenuLabel>
                <ThemeRadioItems theme={theme} onSelectTheme={setTheme} />
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
