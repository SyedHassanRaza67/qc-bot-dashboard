import { Button } from "@/components/ui/button";
import { Filter, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CampaignFiltersProps {
  statusFilter?: string;
  onStatusFilter?: (value: string) => void;
  autoRefresh?: boolean;
  onAutoRefreshToggle?: () => void;
}

export const CampaignFilters = ({
  statusFilter = "all",
  onStatusFilter,
  autoRefresh,
  onAutoRefreshToggle,
}: CampaignFiltersProps) => {
  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6">
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        
        <Select value={statusFilter} onValueChange={onStatusFilter}>
          <SelectTrigger className="w-[160px] rounded-xl">
            <SelectValue placeholder="Call Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="sale">Sale</SelectItem>
            <SelectItem value="callback">Callback</SelectItem>
            <SelectItem value="not-interested">Not Interested</SelectItem>
            <SelectItem value="disqualified">Disqualified</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={autoRefresh ? "default" : "outline"}
          onClick={onAutoRefreshToggle}
          className="ml-auto rounded-xl transition-all duration-200 hover:shadow-md"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
          Auto Refresh
        </Button>
      </div>
    </div>
  );
};