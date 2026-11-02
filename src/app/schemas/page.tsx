"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { AppLayout } from "@/components/layout";
import { useT } from '@/lib/i18n';
import { DataTable } from "@/components/common/data-table";
import { EmptyState, ErrorState, ConfirmDialog } from "@/components/common";
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
  Trash2,
  FileCode,
  ArrowUpDown,
  FileType,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface SchemaItem {
  name: string;
}

export default function SchemasPage() {
  const t = useT();
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [activeTab, setActiveTab] = React.useState<"protobuf" | "custom">("protobuf");
  const [data, setData] = React.useState<SchemaItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteParams, setDeleteParams] = React.useState<{ type: string, name: string } | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!activeServer) return;

    setLoading(true);
    setError(null);
    try {
      const list = await ekuiperClient.listSchemas(activeTab);
      const items = Array.isArray(list) ? list.map(name => ({ name })) : [];
      setData(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch schemas");
    } finally {
      setLoading(false);
    }
  }, [activeServer, activeTab]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteParams || !activeServer) return;

    try {
      await ekuiperClient.deleteSchema(deleteParams.type, deleteParams.name);
      toast.success(t('page.schemaDeleted', { name: deleteParams.name }));
      setDeleteParams(null);
      fetchData();
    } catch (err) {
      toast.error(t('page.schemaDeleteFailed', { error: err instanceof Error ? err.message : t('page.unknownError') }));
    }
  };

  const columns: ColumnDef<SchemaItem>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >{t('page.schemaName')}<ArrowUpDown className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <FileCode className="size-4 text-blue-500" />
          <span className="font-medium font-mono">{row.getValue("name")}</span>
        </div>
      ),
    },
    {
      id: "actions",
      header: t("common.operations"),
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('page.actionsFor', { name: row.original.name })}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => router.push(`/schemas/${activeTab}/${encodeURIComponent(row.original.name)}`)}
              >
                <FileType className="mr-2 size-4" />{t('page.viewEdit')}</DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteParams({ type: activeTab, name: row.original.name })}
              >
                <Trash2 className="mr-2 size-4" />{t('common.delete')}</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (!activeServer) {
    return (
      <AppLayout title={t('nav.schemas')}>
        <EmptyState title={t('page.noServerConnected')} description={t('page.connectToManageSchemas')} />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={t('nav.schemas')}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t('nav.schemas')}</h2>
            <p className="text-muted-foreground">{t('page.schemasHint')}</p>
          </div>
          <Button onClick={() => router.push(`/schemas/new?type=${activeTab}`)}>
            <Plus className="mr-2 size-4" />{t('nav.createSchema')}</Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "protobuf" | "custom")}>
          <TabsList>
            <TabsTrigger value="protobuf">{t('page.schemaTypeProtobuf')}</TabsTrigger>
            <TabsTrigger value="custom">{t('page.schemaTypeCustom')}</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {error ? (
              <ErrorState title={t('common.error')} description={error} onRetry={fetchData} />
            ) : (
              <DataTable
                columns={columns}
                data={data}
                searchKey="name"
                searchPlaceholder={t('page.searchSchemas', { tab: activeTab })}
                loading={loading}
                emptyMessage={t('page.noSchemasFound', { tab: activeTab })}
              />
            )}
          </TabsContent>
        </Tabs>

        <ConfirmDialog
          open={!!deleteParams}
          onOpenChange={(open) => !open && setDeleteParams(null)}
          title={t('page.deleteSchema')}
          description={t('page.deleteSchemaDescription', { name: deleteParams?.name ?? '' })}
          onConfirm={handleDelete}
          variant="danger"
        />
      </div>
    </AppLayout>
  );
}
