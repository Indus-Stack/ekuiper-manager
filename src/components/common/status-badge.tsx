"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/translate";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, Clock, Loader2 } from "lucide-react";

type StatusVariant = "success" | "error" | "warning" | "pending" | "info" | "running" | "stopped";

interface StatusBadgeProps {
  status: StatusVariant | string;
  label?: string;
  className?: string;
  showIcon?: boolean;
}

const statusConfig: Record<
  StatusVariant,
  { icon: typeof CheckCircle; className: string; defaultLabelKey: MessageKey }
> = {
  success: {
    icon: CheckCircle,
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    defaultLabelKey: "layout.statusSuccess",
  },
  running: {
    icon: Loader2,
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    defaultLabelKey: "layout.statusRunning",
  },
  error: {
    icon: XCircle,
    className: "border-destructive/20 bg-destructive/10 text-red-700 dark:text-red-400",
    defaultLabelKey: "layout.statusError",
  },
  stopped: {
    icon: XCircle,
    className: "border-border bg-muted/50 text-muted-foreground",
    defaultLabelKey: "layout.statusStopped",
  },
  warning: {
    icon: AlertCircle,
    className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    defaultLabelKey: "layout.statusWarning",
  },
  pending: {
    icon: Clock,
    className: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400",
    defaultLabelKey: "layout.statusPending",
  },
  info: {
    icon: AlertCircle,
    className: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    defaultLabelKey: "layout.statusInfo",
  },
};

export function StatusBadge({
  status,
  label,
  className,
  showIcon = true,
}: StatusBadgeProps) {
  const t = useT();
  // Map common eKuiper statuses to our variants
  const normalizedStatus = status.toLowerCase() as StatusVariant;
  const config = statusConfig[normalizedStatus] || statusConfig.info;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border font-medium",
        config.className,
        className
      )}
    >
      {showIcon && (
        <Icon
          className={cn(
            "h-3 w-3",
            normalizedStatus === "running" && "animate-spin"
          )}
        />
      )}
      {label || t(config.defaultLabelKey)}
    </Badge>
  );
}
