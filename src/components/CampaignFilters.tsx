import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface CampaignFiltersProps {
  autoRefresh?: boolean;
  onAutoRefreshToggle?: () => void;
}

export const CampaignFilters = ({
  autoRefresh,
  onAutoRefreshToggle,
}: CampaignFiltersProps) => {
  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6">
      <div className="flex justify-end">
        <Button
          variant={autoRefresh ? "default" : "outline"}
          onClick={onAutoRefreshToggle}
          className="rounded-xl transition-all duration-200 hover:shadow-md"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
          Auto Refresh
        </Button>
      </div>
    </div>
  );
};