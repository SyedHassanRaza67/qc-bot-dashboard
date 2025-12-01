import { useState } from "react";
import { Header } from "@/components/Header";
import { StatsGrid } from "@/components/StatsGrid";
import { CampaignFilters } from "@/components/CampaignFilters";
import { CallRecordsTable } from "@/components/CallRecordsTable";

const Dashboard = () => {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Mock data - replace with actual API calls
  const mockRecords = [
    {
      id: "1",
      timestamp: "2025-12-01 10:30:15",
      publisher: "Publisher A",
      callerId: "+1234567890",
      status: "sale" as const,
      agentName: "John Doe",
      subDisposition: "Interested",
      duration: "5:34",
      campaignName: "Summer Campaign",
      reason: "Qualified lead with high intent",
      summary: "Customer expressed strong interest in product features and pricing",
    },
    {
      id: "2",
      timestamp: "2025-12-01 10:25:42",
      publisher: "Publisher B",
      callerId: "+1987654321",
      status: "callback" as const,
      agentName: "Jane Smith",
      subDisposition: "Needs Follow-up",
      duration: "3:12",
      campaignName: "Winter Promotion",
      reason: "Requested more time to consider",
      summary: "Customer wants to discuss with family before making decision",
    },
    {
      id: "3",
      timestamp: "2025-12-01 10:20:18",
      publisher: "Publisher C",
      callerId: "+1555123456",
      status: "not-interested" as const,
      agentName: "Mike Johnson",
      subDisposition: "Not Qualified",
      duration: "1:45",
      campaignName: "Spring Sale",
      reason: "Not interested in product category",
      summary: "Customer already has similar product and not looking to switch",
    },
  ];

  const mockStats = {
    sales: 145,
    callback: 89,
    notInterested: 234,
    disqualified: 56,
    totalCalls: 524,
    avgDuration: "4:23",
    conversionRate: "27.7%",
    activePublishers: 12,
    activeCampaigns: 8,
    pendingReview: 23,
    qualityScore: "94%",
    systemUptime: "99.8%",
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        onSearch={setSearchQuery}
        autoRefresh={autoRefresh}
        onAutoRefreshToggle={() => setAutoRefresh(!autoRefresh)}
      />
      
      <main className="max-w-7xl mx-auto p-6">
        <StatsGrid stats={mockStats} />
        
        <CampaignFilters
          autoRefresh={autoRefresh}
          onAutoRefreshToggle={() => setAutoRefresh(!autoRefresh)}
        />
        
        <CallRecordsTable records={mockRecords} />
      </main>
    </div>
  );
};

export default Dashboard;
