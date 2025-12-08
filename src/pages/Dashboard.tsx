import { useState } from "react";
import { motion } from "framer-motion";
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
import { StatsGrid } from "@/components/StatsGrid";
import { CampaignFilters } from "@/components/CampaignFilters";
import { CallRecordsTable } from "@/components/CallRecordsTable";
import { useCallRecords, useCallStats, DateFilter } from "@/hooks/useCallRecords";

const Dashboard = () => {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: records = [], isLoading: recordsLoading, refetch } = useCallRecords(dateFilter, statusFilter);
  const { data: stats } = useCallStats();

  const filteredRecords = records.filter(record => 
    searchQuery === "" || 
    record.systemCallId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.campaignName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto px-6"
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Track, manage, and analyze your call recordings</p>
        </div>

        {/* Search & Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-center mb-8">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Campaign or System Call ID..."
              className="pl-10 rounded-xl"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="icon"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="rounded-xl transition-all duration-200 hover:shadow-md"
            >
              <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            </Button>
            
            <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
              <SelectTrigger className="w-[140px] rounded-xl">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={() => refetch()} variant="outline" className="rounded-xl">
              Refresh Data
            </Button>
          </div>
        </div>

        <StatsGrid stats={stats} />
        
        <CampaignFilters
          autoRefresh={autoRefresh}
          onAutoRefreshToggle={() => setAutoRefresh(!autoRefresh)}
        />
        
        <CallRecordsTable records={filteredRecords} loading={recordsLoading} />
      </motion.div>
    </div>
  );
};

export default Dashboard;
