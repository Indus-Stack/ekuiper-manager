"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    Database,
    Workflow,
    Server,
    Upload,
} from "lucide-react";

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { useServerStore } from "@/stores/server-store";
import { useT } from "@/lib/i18n";

interface SearchItem {
    id: string;
    title: string;
    type: "stream" | "table" | "rule";
    href: string;
}

export function UnifiedSearch() {
    const t = useT();
    const [open, setOpen] = React.useState(false);
    const router = useRouter();
    const { activeServerId, servers } = useServerStore();
    const activeServer = servers.find(s => s.id === activeServerId);

    const [items, setItems] = React.useState<SearchItem[]>([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const fetchData = React.useCallback(async () => {
        if (!activeServer) return;
        setLoading(true);
        const newItems: SearchItem[] = [];

        try {
            // Parallel fetch
            const [streams, tables, rules] = await Promise.allSettled([
                ekuiperClient.listStreams(),
                ekuiperClient.listTables(),
                ekuiperClient.listRules(),
            ]);

            if (streams.status === "fulfilled") {
                streams.value.forEach(s => newItems.push({ id: `stream-${s.name}`, title: s.name, type: "stream", href: `/streams/${encodeURIComponent(s.name)}` }));
            }
            if (tables.status === "fulfilled") {
                tables.value.forEach(t => newItems.push({ id: `table-${t.name}`, title: t.name, type: "table", href: `/tables/${encodeURIComponent(t.name)}` }));
            }
            if (rules.status === "fulfilled") {
                rules.value.forEach(r => newItems.push({ id: `rule-${r.id}`, title: r.id, type: "rule", href: `/rules/${encodeURIComponent(r.id)}` }));
            }

        } catch (err) {
            console.error("Search fetch error", err);
        } finally {
            setItems(newItems);
            setLoading(false);
        }
    }, [activeServer]);

    React.useEffect(() => {
        if (open) {
            fetchData();
        }
    }, [open, fetchData]);

    const runCommand = React.useCallback((command: () => unknown) => {
        setOpen(false);
        command();
    }, []);

    return (
        <>
            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder={loading ? t("layout.loadingNodeResources") : t("layout.commandPlaceholder")} />
                {loading && (
                    <div className="h-0.5 w-full bg-primary/20 overflow-hidden">
                        <div className="h-full bg-primary animate-pulse w-full" />
                    </div>
                )}
                <CommandList>
                    <CommandEmpty>{t("layout.noResults")}</CommandEmpty>

                    <CommandGroup heading={t("layout.suggestions")}>
                        <CommandItem onSelect={() => runCommand(() => router.push("/dashboard"))}>
                            <Server className="mr-2 h-4 w-4" aria-hidden="true" />
                            <span>{t("nav.overview")}</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/streams"))}>
                            <Database className="mr-2 h-4 w-4" aria-hidden="true" />
                            <span>{t("nav.streams")}</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/rules"))}>
                            <Workflow className="mr-2 h-4 w-4" aria-hidden="true" />
                            <span>{t("nav.rules")}</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/data/import"))}>
                            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                            <span>{t("layout.importConfiguration")}</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    {/* Dynamic Groups */}
                    {items.filter(i => i.type === "rule").length > 0 && (
                        <CommandGroup heading={t("nav.rules")}>
                            {items.filter(i => i.type === "rule").slice(0, 5).map(item => (
                                <CommandItem key={item.id} onSelect={() => runCommand(() => router.push(item.href))}>
                                    <Workflow className="mr-2 h-4 w-4" aria-hidden="true" />
                                    <span>{item.title}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {items.filter(i => i.type === "stream").length > 0 && (
                        <CommandGroup heading={t("nav.streams")}>
                            {items.filter(i => i.type === "stream").slice(0, 5).map(item => (
                                <CommandItem key={item.id} onSelect={() => runCommand(() => router.push(item.href))}>
                                    <Database className="mr-2 h-4 w-4" aria-hidden="true" />
                                    <span>{item.title}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {items.filter(i => i.type === "table").length > 0 && (
                        <CommandGroup heading={t("nav.tables")}>
                            {items.filter(i => i.type === "table").slice(0, 5).map(item => (
                                <CommandItem key={item.id} onSelect={() => runCommand(() => router.push(item.href))}>
                                    <Database className="mr-2 h-4 w-4" aria-hidden="true" />
                                    <span>{item.title}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                </CommandList>
            </CommandDialog>
        </>
    );
}
