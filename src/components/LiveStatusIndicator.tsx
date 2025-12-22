import { Radio, RefreshCw, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveHealthStatus } from "@/hooks/useLiveSync";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface LiveStatusIndicatorProps {
  isLive: boolean;
  healthStatus: LiveHealthStatus;
  isSyncing: boolean;
  lastError: string | null;
  lastSyncAt: Date | null;
  onToggle: () => void;
}

export const LiveStatusIndicator = ({
  isLive,
  healthStatus,
  isSyncing,
  lastError,
  lastSyncAt,
  onToggle,
}: LiveStatusIndicatorProps) => {
  const getStatusConfig = () => {
    if (!isLive) {
      return {
        bgClass: 'bg-muted hover:bg-muted/80 text-muted-foreground',
        icon: WifiOff,
        label: 'Live Off',
        tooltip: 'Click to enable live sync',
      };
    }

    if (isSyncing) {
      return {
        bgClass: 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/30',
        icon: RefreshCw,
        label: 'Syncing...',
        tooltip: 'Syncing data from dialer...',
        iconClass: 'animate-spin',
      };
    }

    switch (healthStatus) {
      case 'healthy':
        return {
          bgClass: 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30',
          icon: Wifi,
          label: 'Live',
          tooltip: lastSyncAt 
            ? `Last sync: ${lastSyncAt.toLocaleTimeString()}` 
            : 'Live mode active',
          iconClass: 'animate-pulse',
        };
      case 'stale':
        return {
          bgClass: 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-lg shadow-yellow-500/30',
          icon: Radio,
          label: 'Live',
          tooltip: lastError || 'Data may be stale - next sync soon',
        };
      case 'error':
        return {
          bgClass: 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30',
          icon: AlertCircle,
          label: 'Error',
          tooltip: lastError || 'Sync error - click to retry',
        };
      default:
        return {
          bgClass: 'bg-muted hover:bg-muted/80 text-muted-foreground',
          icon: Radio,
          label: 'Live',
          tooltip: 'Starting live sync...',
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onToggle}
            className={cn(
              'rounded-xl gap-2 transition-all duration-200',
              config.bgClass
            )}
          >
            <IconComponent className={cn('h-4 w-4', config.iconClass)} />
            {config.label}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
