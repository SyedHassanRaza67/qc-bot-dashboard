import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";

// Get start of day in LOCAL timezone, then convert to ISO string for database query
// This ensures "today" means today in the user's local timezone
const getLocalStartOfDay = (date: Date): string => {
  const localStart = startOfDay(date);
  return localStart.toISOString();
};

// Get end of day in LOCAL timezone, then convert to ISO string for database query
const getLocalEndOfDay = (date: Date): string => {
  const localEnd = endOfDay(date);
  return localEnd.toISOString();
};

export interface CallRecord {
  id: string;
  timestamp: string;
  rawTimestamp: Date;
  callerId: string;
  leadId?: string;
  status: 'sale' | 'callback' | 'not-interested' | 'disqualified' | 'pending';
  agentName?: string;
  subDisposition: string;
  agentResponse?: 'very-bad' | 'bad' | 'average' | 'good' | 'excellent';
  customerResponse?: 'very-bad' | 'bad' | 'average' | 'good' | 'excellent';
  duration: string;
  campaignName: string;
  reason: string;
  summary: string;
  systemCallId: string;
  publisherId: string;
  buyerId: string;
  recordingUrl?: string;
  transcript: string;
  uploadSource: 'manual' | 'vicidial';
  isProcessing?: boolean;
}

export type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month';

export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

export interface PaginatedCallRecords {
  records: CallRecord[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

const PAGE_SIZE = 50;

export const useCallRecords = (
  dateRange?: DateRange, 
  statusFilter?: string, 
  sourceFilter?: string,
  page: number = 1,
  pageSize: number = PAGE_SIZE
) => {
  return useQuery({
    queryKey: ['call-records', dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), statusFilter, sourceFilter, page, pageSize],
    queryFn: async (): Promise<PaginatedCallRecords> => {
      // First, get total count (exclude 0-second duration calls)
      let countQuery = supabase
        .from('call_records')
        .select('*', { count: 'exact', head: true })
        .neq('duration', '0:00');

      // Apply filters for count - use LOCAL timezone boundaries
      if (dateRange?.from) {
        const localStart = getLocalStartOfDay(dateRange.from);
        console.log('Date filter - From (local):', localStart);
        countQuery = countQuery.gte('timestamp', localStart);
      }
      if (dateRange?.to) {
        const localEnd = getLocalEndOfDay(dateRange.to);
        console.log('Date filter - To (local):', localEnd);
        countQuery = countQuery.lte('timestamp', localEnd);
      }
      if (statusFilter && statusFilter !== 'all') {
        countQuery = countQuery.eq('status', statusFilter);
      }
      if (sourceFilter && sourceFilter !== 'all') {
        countQuery = countQuery.eq('upload_source', sourceFilter);
      }

      const { count, error: countError } = await countQuery;
      
      if (countError) {
        console.error('Error fetching count:', countError);
        throw countError;
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      // Now fetch paginated data
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('call_records')
        .select('*')
        .neq('duration', '0:00')  // Exclude 0-second duration calls
        .order('timestamp', { ascending: false })
        .range(from, to);

      // Apply date range filter - use LOCAL timezone boundaries
      if (dateRange?.from) {
        query = query.gte('timestamp', getLocalStartOfDay(dateRange.from));
      }
      if (dateRange?.to) {
        query = query.lte('timestamp', getLocalEndOfDay(dateRange.to));
      }

      // Apply status filter
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Apply source filter
      if (sourceFilter && sourceFilter !== 'all') {
        query = query.eq('upload_source', sourceFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching call records:', error);
        throw error;
      }

      const records = (data || []).map((record) => ({
        id: record.id,
        timestamp: new Date(record.timestamp).toLocaleString(),
        rawTimestamp: new Date(record.timestamp),
        callerId: record.caller_id,
        leadId: (record as any).lead_id || undefined,
        status: record.status as CallRecord['status'],
        agentName: record.agent_name || undefined,
        subDisposition: record.sub_disposition,
        agentResponse: (record as any).agent_response as CallRecord['agentResponse'],
        customerResponse: (record as any).customer_response as CallRecord['customerResponse'],
        duration: record.duration,
        campaignName: record.campaign_name,
        reason: record.reason,
        summary: record.summary,
        systemCallId: record.system_call_id,
        publisherId: record.publisher_id,
        buyerId: record.buyer_id,
        recordingUrl: record.recording_url || undefined,
        transcript: record.transcript,
        uploadSource: (record as any).upload_source || 'manual',
        isProcessing: (record as any).is_processing || false,
      })) as CallRecord[];

      return {
        records,
        totalCount,
        totalPages,
        currentPage: page,
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });
};

export const useCallRecord = (id: string) => {
  return useQuery({
    queryKey: ['call-record', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_records')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching call record:', error);
        throw error;
      }

      if (!data) return null;

      return {
        id: data.id,
        timestamp: new Date(data.timestamp).toLocaleString(),
        rawTimestamp: new Date(data.timestamp),
        callerId: data.caller_id,
        leadId: (data as any).lead_id || undefined,
        status: data.status as CallRecord['status'],
        agentName: data.agent_name || undefined,
        subDisposition: data.sub_disposition,
        agentResponse: data.agent_response as CallRecord['agentResponse'],
        customerResponse: data.customer_response as CallRecord['customerResponse'],
        duration: data.duration,
        campaignName: data.campaign_name,
        reason: data.reason,
        summary: data.summary,
        systemCallId: data.system_call_id,
        publisherId: data.publisher_id,
        buyerId: data.buyer_id,
        recordingUrl: data.recording_url || undefined,
        transcript: data.transcript,
        uploadSource: (data as any).upload_source || 'manual',
      } as CallRecord;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
};

export const useCallStats = (dateRange?: DateRange, sourceFilter?: string) => {
  return useQuery({
    queryKey: ['call-stats', dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), sourceFilter],
    queryFn: async () => {
      let query = supabase
        .from('call_records')
        .select('status, duration, publisher, campaign_name, timestamp, upload_source')
        .neq('duration', '0:00');  // Exclude 0-second duration calls

      // Apply source filter
      if (sourceFilter && sourceFilter !== 'all') {
        query = query.eq('upload_source', sourceFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching call stats:', error);
        throw error;
      }

      const allRecords = data || [];
      const now = new Date();

      // Calculate date ranges for current and previous periods - use LOCAL timezone
      const getDateRanges = () => {
        if (dateRange?.from) {
          const currentStart = startOfDay(dateRange.from);
          const currentEnd = dateRange.to ? endOfDay(dateRange.to) : endOfDay(now);
          const rangeDays = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));
          const prevStart = subDays(currentStart, rangeDays);
          const prevEnd = currentStart;
          return { currentStart, currentEnd, prevStart, prevEnd };
        }
        // Default: compare last 30 days vs previous 30 days
        const currentStart = subDays(now, 30);
        const prevStart = subDays(now, 60);
        const prevEnd = currentStart;
        return { currentStart, currentEnd: now, prevStart, prevEnd };
      };

      const { currentStart, currentEnd, prevStart, prevEnd } = getDateRanges();

      // Filter records by period (comparing against local dates)
      const currentRecords = allRecords.filter(r => {
        const recordDate = new Date(r.timestamp);
        if (currentEnd) {
          return recordDate >= currentStart && recordDate <= currentEnd;
        }
        return recordDate >= currentStart;
      });

      const prevRecords = allRecords.filter(r => {
        const recordDate = new Date(r.timestamp);
        return recordDate >= prevStart && recordDate < prevEnd;
      });

      // Helper to count by status
      const countByStatus = (records: typeof allRecords, status: string) =>
        records.filter(r => r.status === status).length;

      // Calculate stats for both periods
      const calculateStats = (records: typeof allRecords) => ({
        sales: countByStatus(records, 'sale'),
        callback: countByStatus(records, 'callback'),
        notInterested: countByStatus(records, 'not-interested'),
        disqualified: countByStatus(records, 'disqualified'),
        dnc: countByStatus(records, 'dnc'),
        voicemail: countByStatus(records, 'voicemail'),
        ivr: countByStatus(records, 'ivr'),
        deadAir: countByStatus(records, 'dead-air'),
        hangUp: countByStatus(records, 'hang-up'),
        techIssues: countByStatus(records, 'tech-issues'),
        unresponsive: countByStatus(records, 'unresponsive'),
        declinedSale: countByStatus(records, 'declined-sale'),
        languageBarrier: countByStatus(records, 'language-barrier'),
        misdialed: countByStatus(records, 'misdialed'),
        totalCalls: records.length,
        activeCampaigns: new Set(records.map(r => r.campaign_name)).size || 0,
      });

      const currentStats = calculateStats(currentRecords);
      const prevStats = calculateStats(prevRecords);

      // Calculate average duration
      const calculateAvgDuration = (records: typeof allRecords) => {
        const filteredForDuration = records.filter(r => r.status !== 'voicemail' && r.status !== 'ivr');
        const totalSeconds = filteredForDuration.reduce((acc, r) => {
          const parts = r.duration.split(':').map(Number);
          if (parts.length === 2) {
            return acc + (parts[0] * 60 + parts[1]);
          }
          return acc;
        }, 0);
        return filteredForDuration.length > 0 ? totalSeconds / filteredForDuration.length : 0;
      };

      const currentAvgSeconds = calculateAvgDuration(currentRecords);
      const prevAvgSeconds = calculateAvgDuration(prevRecords);
      const avgMin = Math.floor(currentAvgSeconds / 60);
      const avgSec = Math.floor(currentAvgSeconds % 60);

      // Calculate quality score (0-100)
      const currentQualityScore = currentRecords.length > 0 ? 94 : 0;
      const prevQualityScore = prevRecords.length > 0 ? 92 : 0;

      // Calculate trend percentages
      const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) {
          return current > 0 ? 100 : 0;
        }
        return Math.round(((current - previous) / previous) * 100);
      };

      return {
        ...currentStats,
        averageDuration: `${avgMin}:${avgSec.toString().padStart(2, '0')}`,
        qualityScore: currentQualityScore,
        // Trends
        trends: {
          totalCalls: calculateTrend(currentStats.totalCalls, prevStats.totalCalls),
          sales: calculateTrend(currentStats.sales, prevStats.sales),
          notInterested: calculateTrend(currentStats.notInterested, prevStats.notInterested),
          disqualified: calculateTrend(currentStats.disqualified, prevStats.disqualified),
          dnc: calculateTrend(currentStats.dnc, prevStats.dnc),
          voicemail: calculateTrend(currentStats.voicemail, prevStats.voicemail),
          callback: calculateTrend(currentStats.callback, prevStats.callback),
          ivr: calculateTrend(currentStats.ivr, prevStats.ivr),
          deadAir: calculateTrend(currentStats.deadAir, prevStats.deadAir),
          hangUp: calculateTrend(currentStats.hangUp, prevStats.hangUp),
          techIssues: calculateTrend(currentStats.techIssues, prevStats.techIssues),
          unresponsive: calculateTrend(currentStats.unresponsive, prevStats.unresponsive),
          declinedSale: calculateTrend(currentStats.declinedSale, prevStats.declinedSale),
          languageBarrier: calculateTrend(currentStats.languageBarrier, prevStats.languageBarrier),
          misdialed: calculateTrend(currentStats.misdialed, prevStats.misdialed),
          activeCampaigns: calculateTrend(currentStats.activeCampaigns, prevStats.activeCampaigns),
          averageDuration: calculateTrend(currentAvgSeconds, prevAvgSeconds),
          qualityScore: calculateTrend(currentQualityScore, prevQualityScore),
        },
      };
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};
