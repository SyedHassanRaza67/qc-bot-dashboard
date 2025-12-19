import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type MetricType = 'positive' | 'negative' | 'neutral';

interface StatCardProps {
  label: string;
  value: number | string;
  trend?: number;
  metricType?: MetricType;
  filterKey?: string;
  activeFilter?: string;
  onFilterClick?: (filter: string) => void;
}

const StatCard = ({ label, value, trend, metricType = 'neutral', filterKey, activeFilter, onFilterClick }: StatCardProps) => {
  const isClickable = !!filterKey && !!onFilterClick;
  const isActive = filterKey && activeFilter === filterKey;

  // Determine trend direction and color based on metric type
  const getTrendDisplay = () => {
    if (trend === undefined || trend === null) return null;

    const isUp = trend > 0;
    const isDown = trend < 0;
    const isFlat = trend === 0;

    let colorClass = 'text-muted-foreground'; // default gray for no change
    
    if (isFlat) {
      colorClass = 'text-muted-foreground';
    } else if (metricType === 'positive') {
      // For positive metrics: up = good (green), down = bad (red)
      colorClass = isUp ? 'text-emerald-500' : 'text-destructive';
    } else if (metricType === 'negative') {
      // For negative metrics: up = bad (red), down = good (green)
      colorClass = isUp ? 'text-destructive' : 'text-emerald-500';
    } else {
      // Neutral metrics: always blue
      colorClass = 'text-primary';
    }

    const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
    const displayValue = isFlat ? '0%' : `${Math.abs(trend)}%`;

    return (
      <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${colorClass}`}>
        <Icon className="h-3 w-3" />
        <span>{displayValue}</span>
      </div>
    );
  };

  return (
    <div 
      className={`stat-card ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all' : ''} ${isActive ? 'ring-2 ring-primary' : ''}`}
      onClick={() => isClickable && onFilterClick(filterKey)}
    >
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-foreground mb-1">{value}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
        {getTrendDisplay()}
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
    callback?: number;
    ivr?: number;
    deadAir?: number;
    hangUp?: number;
    techIssues?: number;
    unresponsive?: number;
    declinedSale?: number;
    languageBarrier?: number;
    misdialed?: number;
    activeCampaigns?: number;
    averageDuration?: string;
    qualityScore?: number;
    trends?: {
      totalCalls?: number;
      sales?: number;
      notInterested?: number;
      disqualified?: number;
      dnc?: number;
      voicemail?: number;
      callback?: number;
      ivr?: number;
      deadAir?: number;
      hangUp?: number;
      techIssues?: number;
      unresponsive?: number;
      declinedSale?: number;
      languageBarrier?: number;
      misdialed?: number;
      activeCampaigns?: number;
      averageDuration?: number;
      qualityScore?: number;
    };
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
    callback: stats?.callback || 0,
    ivr: stats?.ivr || 0,
    deadAir: stats?.deadAir || 0,
    hangUp: stats?.hangUp || 0,
    techIssues: stats?.techIssues || 0,
    unresponsive: stats?.unresponsive || 0,
    declinedSale: stats?.declinedSale || 0,
    languageBarrier: stats?.languageBarrier || 0,
    misdialed: stats?.misdialed || 0,
    activeCampaigns: stats?.activeCampaigns || 0,
    averageDuration: stats?.averageDuration || "0:00",
    qualityScore: stats?.qualityScore || 0,
  };

  const trends = stats?.trends || {};

  return (
    <div className="space-y-4 mb-6">
      {/* Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Calls" value={defaultStats.totalCalls} trend={trends.totalCalls} metricType="positive" filterKey="all" activeFilter={activeFilter} onFilterClick={onFilterClick} />
        <StatCard label="Sales" value={defaultStats.sales} trend={trends.sales} metricType="positive" filterKey="sale" activeFilter={activeFilter} onFilterClick={onFilterClick} />
        <StatCard label="Not Interested" value={defaultStats.notInterested} trend={trends.notInterested} metricType="negative" filterKey="not-interested" activeFilter={activeFilter} onFilterClick={onFilterClick} />
        <StatCard label="Disqualified" value={defaultStats.disqualified} trend={trends.disqualified} metricType="negative" filterKey="disqualified" activeFilter={activeFilter} onFilterClick={onFilterClick} />
        <StatCard label="DNC" value={defaultStats.dnc} trend={trends.dnc} metricType="negative" filterKey="dnc" activeFilter={activeFilter} onFilterClick={onFilterClick} />
        <StatCard label="Voicemail" value={defaultStats.voicemail} trend={trends.voicemail} metricType="negative" filterKey="voicemail" activeFilter={activeFilter} onFilterClick={onFilterClick} />
      </div>
      {/* Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Call Back" value={defaultStats.callback} trend={trends.callback} metricType="positive" filterKey="callback" activeFilter={activeFilter} onFilterClick={onFilterClick} />
        <StatCard label="IVR" value={defaultStats.ivr} trend={trends.ivr} metricType="negative" filterKey="ivr" activeFilter={activeFilter} onFilterClick={onFilterClick} />
        <StatCard label="Dead Air" value={defaultStats.deadAir} trend={trends.deadAir} metricType="negative" filterKey="dead-air" activeFilter={activeFilter} onFilterClick={onFilterClick} />
        <StatCard label="Hang Up" value={defaultStats.hangUp} trend={trends.hangUp} metricType="negative" filterKey="hang-up" activeFilter={activeFilter} onFilterClick={onFilterClick} />
        <StatCard label="Tech Issues" value={defaultStats.techIssues} trend={trends.techIssues} metricType="negative" filterKey="tech-issues" activeFilter={activeFilter} onFilterClick={onFilterClick} />
        <StatCard label="Unresponsive" value={defaultStats.unresponsive} trend={trends.unresponsive} metricType="negative" filterKey="unresponsive" activeFilter={activeFilter} onFilterClick={onFilterClick} />
      </div>
      {/* Row 3 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Declined Sale" value={defaultStats.declinedSale} trend={trends.declinedSale} metricType="negative" filterKey="declined-sale" activeFilter={activeFilter} onFilterClick={onFilterClick} />
        <StatCard label="Language Barrier" value={defaultStats.languageBarrier} trend={trends.languageBarrier} metricType="negative" filterKey="language-barrier" activeFilter={activeFilter} onFilterClick={onFilterClick} />
        <StatCard label="Misdialed" value={defaultStats.misdialed} trend={trends.misdialed} metricType="negative" filterKey="misdialed" activeFilter={activeFilter} onFilterClick={onFilterClick} />
        <StatCard label="Active Campaigns" value={defaultStats.activeCampaigns} trend={trends.activeCampaigns} metricType="neutral" />
        <StatCard label="Avg Duration" value={defaultStats.averageDuration} trend={trends.averageDuration} metricType="neutral" />
        <StatCard label="Quality Score" value={defaultStats.qualityScore} trend={trends.qualityScore} metricType="positive" />
      </div>
    </div>
  );
};
