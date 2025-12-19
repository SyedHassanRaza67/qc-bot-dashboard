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
    totalCalls?: number;
    sales?: number;
    notInterested?: number;
    disqualified?: number;
    dnc?: number;
    voicemail?: number;
  };
  activeFilter?: string;
  onFilterClick?: (filter: string) => void;
}

export const StatsGrid = ({ stats, activeFilter, onFilterClick }: StatsGridProps) => {
  const defaultStats = {
    totalCalls: stats?.totalCalls || 0,
    sales: stats?.sales || 0,
    notInterested: stats?.notInterested || 0,
    disqualified: stats?.disqualified || 0,
    dnc: stats?.dnc || 0,
    voicemail: stats?.voicemail || 0,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <StatCard label="Total Calls" value={defaultStats.totalCalls} filterKey="all" activeFilter={activeFilter} onFilterClick={onFilterClick} />
      <StatCard label="Sales" value={defaultStats.sales} filterKey="sale" activeFilter={activeFilter} onFilterClick={onFilterClick} />
      <StatCard label="Not Interested" value={defaultStats.notInterested} filterKey="not-interested" activeFilter={activeFilter} onFilterClick={onFilterClick} />
      <StatCard label="Disqualified" value={defaultStats.disqualified} filterKey="disqualified" activeFilter={activeFilter} onFilterClick={onFilterClick} />
      <StatCard label="DNC" value={defaultStats.dnc} filterKey="dnc" activeFilter={activeFilter} onFilterClick={onFilterClick} />
      <StatCard label="Voicemail" value={defaultStats.voicemail} filterKey="voicemail" activeFilter={activeFilter} onFilterClick={onFilterClick} />
    </div>
  );
};