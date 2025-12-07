import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";

export interface CallRecord {
  id: string;
  timestamp: string;
  rawTimestamp: Date;
  status: 'sale' | 'callback' | 'not-interested' | 'disqualified' | 'pending';
  agentName?: string;
  subDisposition: string;
  duration: string;
  campaignName: string;
  reason: string;
  summary: string;
  systemCallId: string;
  publisherId: string;
  buyerId: string;
  recordingUrl?: string;
  transcript: string;
}

export type DateFilter = 'today' | 'yesterday' | 'week' | 'month';

export const useCallRecords = (dateFilter?: DateFilter) => {
  return useQuery({
    queryKey: ['call-records', dateFilter],
    queryFn: async () => {
      let query = supabase
        .from('call_records')
        .select('*')
        .order('timestamp', { ascending: false });

      // Apply date filter
      if (dateFilter) {
        const now = new Date();
        let startDate: Date;

        switch (dateFilter) {
          case 'today':
            startDate = startOfDay(now);
            break;
          case 'yesterday':
            startDate = startOfDay(subDays(now, 1));
            query = query.lt('timestamp', startOfDay(now).toISOString());
            break;
          case 'week':
            startDate = startOfWeek(now, { weekStartsOn: 1 });
            break;
          case 'month':
            startDate = startOfMonth(now);
            break;
          default:
            startDate = startOfDay(now);
        }

        query = query.gte('timestamp', startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching call records:', error);
        throw error;
      }

      return (data || []).map((record) => ({
        id: record.id,
        timestamp: new Date(record.timestamp).toLocaleString(),
        rawTimestamp: new Date(record.timestamp),
        status: record.status as CallRecord['status'],
        agentName: record.agent_name || undefined,
        subDisposition: record.sub_disposition,
        duration: record.duration,
        campaignName: record.campaign_name,
        reason: record.reason,
        summary: record.summary,
        systemCallId: record.system_call_id,
        publisherId: record.publisher_id,
        buyerId: record.buyer_id,
        recordingUrl: record.recording_url || undefined,
        transcript: record.transcript,
      })) as CallRecord[];
    },
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
        status: data.status as CallRecord['status'],
        agentName: data.agent_name || undefined,
        subDisposition: data.sub_disposition,
        duration: data.duration,
        campaignName: data.campaign_name,
        reason: data.reason,
        summary: data.summary,
        systemCallId: data.system_call_id,
        publisherId: data.publisher_id,
        buyerId: data.buyer_id,
        recordingUrl: data.recording_url || undefined,
        transcript: data.transcript,
      } as CallRecord;
    },
    enabled: !!id,
  });
};

export const useCallStats = () => {
  return useQuery({
    queryKey: ['call-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_records')
        .select('status, duration, publisher, campaign_name');

      if (error) {
        console.error('Error fetching call stats:', error);
        throw error;
      }

      const records = data || [];
      
      // Calculate stats
      const stats = {
        sales: records.filter(r => r.status === 'sale').length,
        callback: records.filter(r => r.status === 'callback').length,
        notInterested: records.filter(r => r.status === 'not-interested').length,
        disqualified: records.filter(r => r.status === 'disqualified').length,
        totalCalls: records.length,
        pendingReview: records.filter(r => r.status === 'pending').length,
      };

      // Calculate average duration
      const totalSeconds = records.reduce((acc, r) => {
        const [min, sec] = r.duration.split(':').map(Number);
        return acc + (min * 60 + sec);
      }, 0);
      const avgSeconds = records.length > 0 ? totalSeconds / records.length : 0;
      const avgMin = Math.floor(avgSeconds / 60);
      const avgSec = Math.floor(avgSeconds % 60);

      // Calculate conversion rate
      const conversionRate = records.length > 0 
        ? ((stats.sales / records.length) * 100).toFixed(1) + '%'
        : '0%';

      return {
        ...stats,
        avgDuration: `${avgMin}:${avgSec.toString().padStart(2, '0')}`,
        conversionRate,
        activePublishers: new Set(records.map(r => r.publisher)).size || 0,
        activeCampaigns: new Set(records.map(r => r.campaign_name)).size || 0,
        qualityScore: records.length > 0 ? '94%' : '0%',
        systemUptime: '99.8%',
      };
    },
  });
};
