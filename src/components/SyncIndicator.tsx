import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SyncIndicatorProps {
  isSyncing: boolean;
  className?: string;
}

export const SyncIndicator = ({ isSyncing, className }: SyncIndicatorProps) => {
  if (!isSyncing) return null;

  return (
    <div className={cn("flex items-center gap-2 text-sm text-primary", className)}>
      <div className="relative">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
      </div>
      <span className="animate-pulse">Syncing...</span>
    </div>
  );
};
