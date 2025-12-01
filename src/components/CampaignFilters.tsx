import { Button } from "@/components/ui/button";
import { Calendar, Filter, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CampaignFiltersProps {
  onPublisherFilter?: (value: string) => void;
  onTargetFilter?: (value: string) => void;
  onBuyerFilter?: (value: string) => void;
  onDateChange?: (value: string) => void;
  autoRefresh?: boolean;
  onAutoRefreshToggle?: () => void;
}

export const CampaignFilters = ({
  onPublisherFilter,
  onTargetFilter,
  onBuyerFilter,
  onDateChange,
  autoRefresh,
  onAutoRefreshToggle,
}: CampaignFiltersProps) => {
  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        
        <Select onValueChange={onPublisherFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Publishers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Publishers</SelectItem>
            <SelectItem value="pub1">Publisher 1</SelectItem>
            <SelectItem value="pub2">Publisher 2</SelectItem>
          </SelectContent>
        </Select>

        <Select onValueChange={onTargetFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Targets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Targets</SelectItem>
            <SelectItem value="target1">Target 1</SelectItem>
            <SelectItem value="target2">Target 2</SelectItem>
          </SelectContent>
        </Select>

        <Select onValueChange={onBuyerFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Buyers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buyers</SelectItem>
            <SelectItem value="buyer1">Buyer 1</SelectItem>
            <SelectItem value="buyer2">Buyer 2</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="today" onValueChange={onDateChange}>
          <SelectTrigger className="w-[140px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={autoRefresh ? "default" : "outline"}
          onClick={onAutoRefreshToggle}
          className="ml-auto transition-all duration-200 hover:shadow-md"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
          Auto Refresh
        </Button>
      </div>
    </div>
  );
};
