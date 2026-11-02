"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { AppLayout } from "@/components/layout";
import { useT } from '@/lib/i18n';
import { EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ArrowLeft,
  Loader2,
  Server,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function NewServicePage() {
  const t = useT();
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [name, setName] = React.useState("");
  const [file, setFile] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const handleCreate = async () => {
    if (!activeServer) return;

    if (!name) {
      toast.error("Service name is required");
      return;
    }

    if (!file) {
      toast.error("Service package URI is required");
      return;
    }

    setCreating(true);

    try {
      await ekuiperClient.createService({ name, file });

      toast.success(`Service "${name}" registered successfully`);
      router.push("/services");
    } catch (err) {
      toast.error(`Failed to register service: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setCreating(false);
    }
  };

  if (!activeServer) {
    return (
      <AppLayout title={t('nav.registerService')}>
        <EmptyState
          title={t('extension.noServerConnected')}
          description={t('extension.connectToRegisterServices')}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={t('nav.registerService')}>
      <div className="flex flex-col gap-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/services")}
            aria-label={t('extension.backToServices')}
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>
          <div className="flex items-center gap-3">
            <Server className="size-5 text-blue-500" aria-hidden="true" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{t('extension.registerExternalService')}</h2>
              <p className="text-muted-foreground">{t('extension.registerServiceHint')}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t('extension.serviceConfig')}</CardTitle>
            <CardDescription>
              eKuiper installs services from a zip package containing the service definition and interfaces.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {/* Basic Info */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">{t('extension.serviceName')}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="myService"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="file">{t('extension.servicePackageUri')}</Label>
                <Input
                  id="file"
                  value={file}
                  onChange={(e) => setFile(e.target.value)}
                  placeholder="https://example.com/my-service.zip"
                />
                <p className="text-sm text-muted-foreground">{t('extension.httpOrFileUri')}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push("/services")}
              >{t('common.cancel')}</Button>
              <Button onClick={handleCreate} disabled={creating || !name.trim() || !file.trim()}>
                {creating && <Loader2 className="mr-2 size-4 animate-spin" />}
                Register Service
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
