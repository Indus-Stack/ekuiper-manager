'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Check,
  Database,
  Globe,
  HelpCircle,
  KeyRound,
  Server,
  Users,
} from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { LOCALES, LOCALE_LABELS, useI18n, type Locale } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  const { locale, setLocale, t } = useI18n();

  return (
    <AppLayout title={t('nav.settings')}>
      <div className="mx-auto max-w-4xl flex flex-col gap-6 pb-12">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Manager settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Control plane configuration, user authorization, and system preferences.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Node Management */}
          <Card className="flex flex-col justify-between border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="size-5 text-primary" />
                eKuiper nodes
              </CardTitle>
              <CardDescription className="text-xs">
                Register edge clusters, inspect connection health, and switch active node.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm">
                <Link href="/nodes">Manage nodes</Link>
              </Button>
            </CardContent>
          </Card>

          {/* User Management */}
          <Card className="flex flex-col justify-between border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-5 text-primary" />
                Users & Roles
              </CardTitle>
              <CardDescription className="text-xs">
                Manage operator accounts, access roles, and audit security credentials.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/users">Manage users</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Security Credentials */}
          <Card className="flex flex-col justify-between border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="size-5 text-primary" />
                Password & Security
              </CardTitle>
              <CardDescription className="text-xs">
                Update account credentials and rotate access tokens.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/change-password">Change password</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Documentation & Help */}
          <Card className="flex flex-col justify-between border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HelpCircle className="size-5 text-primary" />
                Documentation & Reference
              </CardTitle>
              <CardDescription className="text-xs">
                Architecture guides, streaming SQL syntax, and CLI operator manual.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/help">Open help center</Link>
              </Button>
            </CardContent>
          </Card>
        </div>


        {/* Language & Localization */}
        <Card className="border-border/80 bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="size-5 text-primary" />
              {t('common.language')}
            </CardTitle>
            <CardDescription className="text-xs">
              The interface language. The choice is stored in this browser and applies immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {LOCALES.map((option: Locale) => (
                <Button
                  key={option}
                  variant={locale === option ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2 text-xs"
                  onClick={() => setLocale(option)}
                >
                  {locale === option && <Check className="size-3.5" aria-hidden="true" />}
                  {LOCALE_LABELS[option]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Persistence & Data Integrity */}
        <Card className="border-border/80 bg-card/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-5 text-primary" />
              Persistence Architecture
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Manager state is stored in central SQLite / PostgreSQL persistence and migrated automatically at startup.
              No ephemeral browser-only storage is used for cluster registration, preventing credential loss across container restarts.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </AppLayout>
  );
}
