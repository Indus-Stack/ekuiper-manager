'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, ExternalLink, RefreshCw, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { useT } from '@/lib/i18n';

type ApiContractSpec = '2.4.2' | '2.5-preview';

export default function ApiDocsPage() {
  const t = useT();
  const [specMode, setSpecMode] = React.useState<ApiContractSpec>('2.4.2');
  const [iframeKey, setIframeKey] = React.useState(0);
  const [isLoaded, setIsLoaded] = React.useState(false);

  const iframeSrc =
    specMode === '2.5-preview' ? '/api-docs/index.html?spec=2.5-preview' : '/api-docs/index.html';

  const handleSpecChange = (nextSpec: ApiContractSpec) => {
    if (nextSpec === specMode) return;
    setIsLoaded(false);
    setSpecMode(nextSpec);
    setIframeKey((k) => k + 1);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Control Plane Header */}
      <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/80 bg-card px-4 py-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground transition-transform duration-150 active:scale-[0.97] hover:text-foreground"
          >
            <Link href="/help">
              <ArrowLeft className="h-3.5 w-3.5" />{t('admin.documentation')}</Link>
          </Button>

          <div className="hidden h-4 w-px bg-border sm:block" />

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold tracking-tight text-foreground">
              eKuiper & Gateway REST API Reference
            </span>
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px] font-mono font-medium text-muted-foreground"
              data-testid="api-docs-version-badge"
            >
              {specMode === '2.5-preview' ? '2.5.0-alpha.5 Preview · OpenAPI 3.0' : '2.4.2 · OpenAPI 3.0'}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5"
            role="group"
            aria-label={t('admin.apiContractSwitcher')}
          >
            <Button
              type="button"
              variant={specMode === '2.4.2' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleSpecChange('2.4.2')}
              className="h-7 px-2.5 text-xs font-medium"
              aria-pressed={specMode === '2.4.2'}
              data-testid="api-docs-spec-ga"
            >
              {t('admin.apiContractGa')}
            </Button>
            <Button
              type="button"
              variant={specMode === '2.5-preview' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleSpecChange('2.5-preview')}
              className="h-7 px-2.5 text-xs font-medium"
              aria-pressed={specMode === '2.5-preview'}
              data-testid="api-docs-spec-preview"
            >
              {t('admin.apiContractPreview')}
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsLoaded(false);
              setIframeKey((k) => k + 1);
            }}
            className="h-8 gap-1.5 text-xs transition-transform duration-150 active:scale-[0.97]"
            title={t('admin.reloadApiDocs')}
          >
            <RefreshCw className="h-3.5 w-3.5" />{t('admin.reload')}</Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs transition-transform duration-150 active:scale-[0.97]"
          >
            <a href={iframeSrc} target="_blank" rel="noopener noreferrer">{t('admin.openFullscreen')}<ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </header>

      {/* Main Viewport */}
      <div className="relative flex-1 bg-white">
        {!isLoaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
            <div className="flex h-10 w-10 animate-spin items-center justify-center rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground">Rendering OpenAPI interactive reference…</p>
          </div>
        )}

        <iframe
          key={`${specMode}-${iframeKey}`}
          src={iframeSrc}
          onLoad={() => setIsLoaded(true)}
          title={t('admin.interactiveApiDocs')}
          className="h-full w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
