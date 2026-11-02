"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { ImportStatus } from "@/lib/ekuiper/types";
import { AppLayout } from "@/components/layout";
import { useT } from '@/lib/i18n';
import { EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
    UploadCloud,
    FileJson,
    AlertTriangle,
    Loader2,
    XCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function DataImportPage() {
  const t = useT();
    const { servers, activeServerId } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [uploading, setUploading] = React.useState(false);
    const [importStatus, setImportStatus] = React.useState<ImportStatus | null>(null);
    const [optionStop, setOptionStop] = React.useState(false);
    const [optionPartial, setOptionPartial] = React.useState(false);

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState("data");

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) await processImport(file);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await processImport(file);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const processImport = async (file: File) => {
        if (!activeServer) return;

        // Basic validation
        if (!file.name.endsWith(".json")) {
            toast.error(t('extension.uploadJsonRequired'));
            return;
        }

        setUploading(true);
        setImportStatus({ status: "running", message: t('extension.startingUpload'), progress: 0 });
        const pollInterval = setInterval(async () => {
            try {
                const status = await ekuiperClient.getImportStatus();
                setImportStatus(status);
            } catch { /* ignore poll errors */ }
        }, 1000);

        try {
            const fileContent = await file.text();

            // Validate JSON
            try {
                JSON.parse(fileContent);
            } catch (parseErr) {
                clearInterval(pollInterval);
                toast.error(t('extension.invalidJsonFile'));
                setUploading(false);
                setImportStatus(null);
                return;
            }

            if (activeTab === "data") {
                await ekuiperClient.importData(fileContent, { stop: optionStop, partial: optionPartial });
                toast.success("eKuiper configuration imported successfully");
            } else {
                await ekuiperClient.importRuleset(fileContent);
                toast.success(t('extension.rulesetImported'));
            }
        } catch (err: any) {
            const errorMsg = err?.message || err?.error || t('extension.structureMismatch');
            console.error(t('extension.importErrorDetails'), err);
            toast.error(`Import failed: ${errorMsg}`);
            setImportStatus({ status: "failed", message: errorMsg, errors: [errorMsg] });
        } finally {
            clearInterval(pollInterval);
            setUploading(false);
            // Keep status visible for a moment if desired, but we reset for now or keep it if failed
            if (activeTab === "data") {
                // Try one last fetch to see final state
                const final = await ekuiperClient.getImportStatus().catch(() => null);
                if (final) setImportStatus(final);
            }
        }
    };

    if (!activeServer) {
        return (
            <AppLayout title={t('nav.dataImportFull')}>
                <EmptyState title={t('extension.noServerConnected')} description={t('admin.connectToImport')} />
            </AppLayout>
        );
    }

    return (
        <AppLayout title={t('nav.dataImportFull')}>
            <div className="max-w-3xl mx-auto flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold">{t('admin.importConfig')}</h1>
                    <p className="text-muted-foreground">{t('admin.importPageHint')}</p>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="data">{t('admin.configuration')}</TabsTrigger>
                        <TabsTrigger value="rules">{t('admin.rulesetOnly')}</TabsTrigger>
                    </TabsList>

                    <Card className="mt-6 border-dashed border-2">
                        <CardContent className="pt-6">
                            {uploading ? (
                                <div className="flex flex-col items-center justify-center py-10 gap-4">
                                    <Loader2 className="size-10 animate-spin text-primary" />
                                    <div className="flex flex-col gap-2 text-center w-full max-w-md">
                                        <h3 className="font-semibold text-lg">{t('admin.importing')}</h3>
                                        <p className="text-sm text-muted-foreground">{importStatus?.message || t('extension.processing')}</p>
                                        {importStatus && (
                                            <Progress value={(importStatus.progress || 0) * 100} className="w-full h-2" />
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className={cn(
                                        "flex flex-col items-center justify-center py-12 text-center cursor-pointer rounded-lg transition-colors hover:bg-muted/50",
                                        isDragging && "bg-primary/10 border-primary"
                                    )}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            fileInputRef.current?.click();
                                        }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={activeTab === 'data' ? t('admin.selectConfigFile') : t('admin.selectRulesetFile')}
                                >
                                    <div className="p-4 rounded-full bg-primary/10 mb-4">
                                        {activeTab === 'data' ? <UploadCloud className="size-8 text-primary" /> : <FileJson className="size-8 text-primary" />}
                                    </div>
                                    <h3 className="text-lg font-semibold mb-1">
                                        {activeTab === 'data' ? t('admin.dragDropConfigFile') : t('admin.dragDropRulesetFile')}
                                    </h3>
                                    <p className="text-muted-foreground text-sm mb-4">
                                        {t('admin.orClickToBrowse')}
                                    </p>
                                    <p className="text-xs text-muted-foreground/70">{t('admin.acceptsJson')}</p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".json"
                                        className="hidden"
                                        onChange={handleFileSelect}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <TabsContent value="data" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('admin.importOptions')}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-4">
                                <div className="flex items-center gap-2">
                                    <Checkbox id="stop" checked={optionStop} onCheckedChange={(c) => setOptionStop(!!c)} />
                                    <Label htmlFor="stop" className="cursor-pointer">{t('admin.stopBeforeImport')}</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Checkbox id="partial" checked={optionPartial} onCheckedChange={(c) => setOptionPartial(!!c)} />
                                    <Label htmlFor="partial" className="cursor-pointer">{t('admin.partialImport')}</Label>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="rules" className="mt-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start gap-3 text-sm text-blue-700 dark:text-blue-300">
                            <AlertTriangle className="size-5 shrink-0" />
                            <p>{t('extension.importRulesetHint')}</p>
                        </div>
                    </TabsContent>
                </Tabs>

                {importStatus?.errors && importStatus.errors.length > 0 && (
                    <Card className="border-destructive/50 bg-destructive/10">
                        <CardHeader>
                            <CardTitle className="text-destructive flex items-center gap-2">
                                <XCircle className="size-5" />{t('admin.importErrors')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="list-disc list-inside text-sm text-destructive font-medium">
                                {importStatus.errors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}
