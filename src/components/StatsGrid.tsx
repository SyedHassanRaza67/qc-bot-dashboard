import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  trend?: number;
  trendDirection?: 'up' | 'down';
}

const StatCard = ({ label, value, trend, trendDirection }: StatCardProps) => {
  return (
    <div className="stat-card">
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-foreground mb-1">{value}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${
            trendDirection === 'up' ? 'text-success' : 'text-destructive'
          }`}>
            {trendDirection === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface StatsGridProps {
  stats?: {
    sales?: number;
    callback?: number;
    notInterested?: number;
    disqualified?: number;
    totalCalls?: number;
    avgDuration?: string;
    conversionRate?: string;
    activePublishers?: number;
    activeCampaigns?: number;
    pendingReview?: number;
    qualityScore?: string;
    systemUptime?: string;
  };
}

export const StatsGrid = ({ stats }: StatsGridProps) => {
  const defaultStats = {
    sales: stats?.sales || 0,
    callback: stats?.callback || 0,
    notInterested: stats?.notInterested || 0,
    disqualified: stats?.disqualified || 0,
    totalCalls: stats?.totalCalls || 0,
    avgDuration: stats?.avgDuration || "0:00",
    conversionRate: stats?.conversionRate || "0%",
    activePublishers: stats?.activePublishers || 0,
    activeCampaigns: stats?.activeCampaigns || 0,
    pendingReview: stats?.pendingReview || 0,
    qualityScore: stats?.qualityScore || "0%",
    systemUptime: stats?.systemUptime || "100%",
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <StatCard label="Sales" value={defaultStats.sales} trend={12} trendDirection="up" />
      <StatCard label="Callback" value={defaultStats.callback} trend={5} trendDirection="up" />
      <StatCard label="Not Interested" value={defaultStats.notInterested} trend={3} trendDirection="down" />
      <StatCard label="Disqualified" value={defaultStats.disqualified} trend={2} trendDirection="down" />
      <StatCard label="Total Calls" value={defaultStats.totalCalls} trend={8} trendDirection="up" />
      <StatCard label="Avg Duration" value={defaultStats.avgDuration} />
      <StatCard label="Conversion Rate" value={defaultStats.conversionRate} trend={15} trendDirection="up" />
      <StatCard label="Active Publishers" value={defaultStats.activePublishers} />
      <StatCard label="Active Campaigns" value={defaultStats.activeCampaigns} />
      <StatCard label="Pending Review" value={defaultStats.pendingReview} />
      <StatCard label="Quality Score" value={defaultStats.qualityScore} trend={7} trendDirection="up" />
      <StatCard label="System Uptime" value={defaultStats.systemUptime} />
    </div>
  );
};
