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

import { useT } from '@/lib/i18n';
export default function SettingsPage() {
  const { locale, setLocale, t } = useI18n();

  return (
    <AppLayout title={t('nav.settings')}>
      <div className="mx-auto max-w-4xl flex flex-col gap-6 pb-12">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t('admin.settingsTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('admin.settingsHintShort')}
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
                {t('admin.settingsNodesHint')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm">
                <Link href="/nodes">{t('admin.manageNodes')}</Link>
              </Button>
            </CardContent>
          </Card>

          {/* User Management */}
          <Card className="flex flex-col justify-between border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-5 text-primary" />{t('admin.usersRoles')}</CardTitle>
              <CardDescription className="text-xs">{t('admin.settingsSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/users">{t('admin.manageUsers')}</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Security Credentials */}
          <Card className="flex flex-col justify-between border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="size-5 text-primary" />{t('admin.passwordSecurity')}</CardTitle>
              <CardDescription className="text-xs">{t('admin.updateCredentials')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/change-password">{t('admin.changePassword')}</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Documentation & Help */}
          <Card className="flex flex-col justify-between border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HelpCircle className="size-5 text-primary" />{t('admin.docsRef')}</CardTitle>
              <CardDescription className="text-xs">{t('admin.docsBlurb')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/help">{t('admin.openHelpCenter')}</Link>
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
              {t('admin.languageOptionHint')}
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
              <Database className="size-5 text-primary" />{t('admin.persistenceArchitecture')}</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {t('admin.settingsPersistenceHint')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </AppLayout>
  );
}
