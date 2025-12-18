import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  trend?: number;
  trendDirection?: 'up' | 'down';
  filterKey?: string;
  activeFilter?: string;
  onFilterClick?: (filter: string) => void;
}

const StatCard = ({ label, value, trend, trendDirection, filterKey, activeFilter, onFilterClick }: StatCardProps) => {
  const isClickable = !!filterKey && !!onFilterClick;
  const isActive = filterKey && activeFilter === filterKey;
  
  return (
    <div 
      className={`stat-card ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all' : ''} ${isActive ? 'ring-2 ring-primary' : ''}`}
      onClick={() => isClickable && onFilterClick(filterKey)}
    >
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
    agentResponseRate?: string;
    activeCampaigns?: number;
    pendingReview?: number;
    qualityScore?: string;
    systemUptime?: string;
  };
  activeFilter?: string;
  onFilterClick?: (filter: string) => void;
}

export const StatsGrid = ({ stats, activeFilter, onFilterClick }: StatsGridProps) => {
  const defaultStats = {
    sales: stats?.sales || 0,
    callback: stats?.callback || 0,
    notInterested: stats?.notInterested || 0,
    disqualified: stats?.disqualified || 0,
    totalCalls: stats?.totalCalls || 0,
    avgDuration: stats?.avgDuration || "0:00",
    conversionRate: stats?.conversionRate || "0%",
    agentResponseRate: stats?.agentResponseRate || "0%",
    activeCampaigns: stats?.activeCampaigns || 0,
    pendingReview: stats?.pendingReview || 0,
    qualityScore: stats?.qualityScore || "0%",
    systemUptime: stats?.systemUptime || "100%",
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <StatCard label="Sales" value={defaultStats.sales} trend={12} trendDirection="up" filterKey="sale" activeFilter={activeFilter} onFilterClick={onFilterClick} />
      <StatCard label="Callback" value={defaultStats.callback} trend={5} trendDirection="up" filterKey="callback" activeFilter={activeFilter} onFilterClick={onFilterClick} />
      <StatCard label="Not Interested" value={defaultStats.notInterested} trend={3} trendDirection="down" filterKey="not-interested" activeFilter={activeFilter} onFilterClick={onFilterClick} />
      <StatCard label="Disqualified" value={defaultStats.disqualified} trend={2} trendDirection="down" filterKey="disqualified" activeFilter={activeFilter} onFilterClick={onFilterClick} />
      <StatCard label="Total Calls" value={defaultStats.totalCalls} trend={8} trendDirection="up" filterKey="all" activeFilter={activeFilter} onFilterClick={onFilterClick} />
      <StatCard label="Avg Duration" value={defaultStats.avgDuration} />
      <StatCard label="Conversion Rate" value={defaultStats.conversionRate} trend={15} trendDirection="up" />
      <StatCard label="Agent Response Rate" value={defaultStats.agentResponseRate} trend={4} trendDirection="up" />
      <StatCard label="Active Campaigns" value={defaultStats.activeCampaigns} />
      <StatCard label="Pending Review" value={defaultStats.pendingReview} filterKey="pending" activeFilter={activeFilter} onFilterClick={onFilterClick} />
      <StatCard label="Quality Score" value={defaultStats.qualityScore} trend={7} trendDirection="up" />
      <StatCard label="System Uptime" value={defaultStats.systemUptime} />
    </div>
  );
};