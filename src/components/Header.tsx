import { Search, RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HeaderProps {
  onSearch?: (value: string) => void;
  autoRefresh?: boolean;
  onAutoRefreshToggle?: () => void;
}

export const Header = ({ onSearch, autoRefresh, onAutoRefreshToggle }: HeaderProps) => {
  return (
    <header className="bg-card border-b border-border p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to AI Audio Analyzer</h1>
          <p className="text-muted-foreground">Track, Manage, and Analyze Leads with AI QC Bots</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search CID..."
              className="pl-10"
              onChange={(e) => onSearch?.(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="icon"
              onClick={onAutoRefreshToggle}
              className="transition-all duration-200 hover:shadow-md"
            >
              <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            </Button>
            
            <Select defaultValue="today">
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
          </div>
        </div>
      </div>
    </header>
  );
};
