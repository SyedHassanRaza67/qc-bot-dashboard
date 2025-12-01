import { useState } from "react";
import { Header } from "@/components/Header";
import { StatsGrid } from "@/components/StatsGrid";
import { CampaignFilters } from "@/components/CampaignFilters";
import { CallRecordsTable } from "@/components/CallRecordsTable";
import { AudioUpload } from "@/components/AudioUpload";
import { useCallRecords, useCallStats } from "@/hooks/useCallRecords";

const Dashboard = () => {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: records = [], isLoading: recordsLoading, refetch } = useCallRecords();
  const { data: stats, isLoading: statsLoading } = useCallStats();

  // Filter records based on search query
  const filteredRecords = records.filter(record => 
    searchQuery === "" || 
    record.callerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.systemCallId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Header 
        onSearch={setSearchQuery}
        autoRefresh={autoRefresh}
        onAutoRefreshToggle={() => setAutoRefresh(!autoRefresh)}
      />
      
      <main className="max-w-7xl mx-auto p-6">
        <AudioUpload onUploadComplete={() => refetch()} />
        
        <StatsGrid stats={stats} />
        
        <CampaignFilters
          autoRefresh={autoRefresh}
          onAutoRefreshToggle={() => setAutoRefresh(!autoRefresh)}
        />
        
        <CallRecordsTable records={filteredRecords} loading={recordsLoading} />
      </main>
    </div>
  );
};

export default Dashboard;
