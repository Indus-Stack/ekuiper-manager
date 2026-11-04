"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import type { PluginType } from "@/lib/ekuiper/types";
import { AppLayout } from "@/components/layout";
import { useT } from '@/lib/i18n';
import { DataTable } from "@/components/common/data-table";
import { StatusBadge, EmptyState, ErrorState, ConfirmDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  MoreHorizontal,
  Eye,
  Trash2,
  Plug,
  ArrowUpDown,
  Code2,
  Box,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Plugin {
  name: string;
  version?: string;
}

type InstallablePluginType = Exclude<PluginType, "udfs">;

export default function PluginsPage() {
  const t = useT();
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [activeTab, setActiveTab] = React.useState<InstallablePluginType>("sources");
  // activeTab is an internal routing key ('sources'/'sinks'/...); the UI
  // must show its localized label instead of the raw slice.
  const pluginTypeLabels: Record<InstallablePluginType, string> = {
    sources: t('extension.sources'),
    sinks: t('extension.sinks'),
    functions: t('extension.functions'),
    portables: t('extension.portables'),
  };
  const typeLabel = pluginTypeLabels[activeTab];
  const [plugins, setPlugins] = React.useState<Plugin[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deletePlugin, setDeletePlugin] = React.useState<{ name: string; type: InstallablePluginType } | null>(null);

  const fetchPlugins = React.useCallback(async (type: InstallablePluginType) => {
    if (!activeServer) {
      setError(t('extension.noServerSelected'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await ekuiperClient.listPlugins(type);
      const pluginList = Array.isArray(data)
        ? data.map((name: string) => ({ name }))
        : [];
      setPlugins(pluginList);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('extension.failedFetchPlugins'));
    } finally {
      setLoading(false);
    }
  }, [activeServer]);

  React.useEffect(() => {
    fetchPlugins(activeTab);
  }, [fetchPlugins, activeTab]);

  const handleDeletePlugin = async () => {
    if (!deletePlugin || !activeServer) return;

    try {
      await ekuiperClient.deletePlugin(deletePlugin.type, deletePlugin.name);

      toast.success(`Plugin "${deletePlugin.name}" deleted successfully`);
      setDeletePlugin(null);
      fetchPlugins(activeTab);
    } catch (err) {
      toast.error(`Failed to delete plugin: ${err instanceof Error ? err.message : t('extension.unknownError')}`);
    }
  };

  const getPluginIcon = (type: InstallablePluginType) => {
    switch (type) {
      case "sources":
        return <Plug className="size-4 text-blue-500" />;
      case "sinks":
        return <Plug className="size-4 text-green-500" />;
      case "functions":
        return <Code2 className="size-4 text-purple-500" />;
      case "portables":
        return <Box className="size-4 text-orange-500" />;
    }
  };

  const columns: ColumnDef<Plugin>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >{t('extension.name')}<ArrowUpDown className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {getPluginIcon(activeTab)}
          <span className="font-medium">{row.getValue("name")}</span>
        </div>
      ),
    },
    {
      id: "type",
      header: t('extension.typeColumn'),
      cell: () => (
        <StatusBadge status="info" label={typeLabel} showIcon={false} />
      ),
    },
    {
      id: "actions",
      header: t('extension.actionsColumn'),
      cell: ({ row }) => {
        const plugin = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${plugin.name}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => router.push(`/plugins/${activeTab}/${encodeURIComponent(plugin.name)}`)}
                >
                  <Eye className="mr-2 size-4" />{t('extension.viewDetails')}</DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeletePlugin({ name: plugin.name, type: activeTab })}
                >
                  <Trash2 className="mr-2 size-4" />{t('extension.delete')}</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (!activeServer) {
    return (
      <AppLayout title={t('nav.plugins')}>
        <EmptyState
          title={t('extension.noServerConnected')}
          description={t('extension.connectToManagePlugins')}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={t('nav.plugins')}>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t('extension.plugins')}</h2>
            <p className="text-muted-foreground">{t('extension.pluginsHint')}</p>
          </div>
          <Button onClick={() => router.push(`/plugins/${activeTab}/new`)}>
            <Plus className="mr-2 size-4" />{t('extension.installPlugin')}</Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as InstallablePluginType)}>
          <TabsList>
            <TabsTrigger value="sources">
              <Plug className="mr-2 size-4" />{t('extension.sources')}</TabsTrigger>
            <TabsTrigger value="sinks">
              <Plug className="mr-2 size-4" />{t('extension.sinks')}</TabsTrigger>
            <TabsTrigger value="functions">
              <Code2 className="mr-2 size-4" />{t('extension.functions')}</TabsTrigger>
            <TabsTrigger value="portables">
              <Box className="mr-2 size-4" />{t('extension.portables')}</TabsTrigger>
          </TabsList>

          {(["sources", "sinks", "functions", "portables"] as InstallablePluginType[]).map((type) => (
            <TabsContent key={type} value={type}>
              {error ? (
                <ErrorState
                  title={t('extension.errorLoadingPlugins')}
                  description={error}
                  onRetry={() => fetchPlugins(activeTab)}
                />
              ) : (
                <DataTable
                  columns={columns}
                  data={plugins}
                  searchKey="name"
                  searchPlaceholder={t('extension.searchPlugins', { type: typeLabel })}
                  loading={loading}
                  emptyMessage={t('extension.noPluginsFound', { type: typeLabel })}
                  emptyDescription={t('extension.installPluginHint', { type: typeLabel })}
                  onRefresh={() => fetchPlugins(activeTab)}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletePlugin}
        onOpenChange={(open) => !open && setDeletePlugin(null)}
        title={t('extension.deletePlugin')}
        description={`Are you sure you want to delete the plugin "${deletePlugin?.name}"? This action cannot be undone.`}
        confirmLabel={t('extension.delete')}
        variant="danger"
        onConfirm={handleDeletePlugin}
      />
    </AppLayout>
  );
}
