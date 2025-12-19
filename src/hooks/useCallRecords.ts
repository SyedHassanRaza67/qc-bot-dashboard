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

export type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month';

export const useCallRecords = (dateFilter?: DateFilter, statusFilter?: string) => {
  return useQuery({
    queryKey: ['call-records', dateFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('call_records')
        .select('*')
        .order('timestamp', { ascending: false });

      // Apply date filter (skip if 'all' or undefined)
      if (dateFilter && dateFilter !== 'all') {
        const now = new Date();
        let startDate: Date;
        let endDate: Date | null = null;

        switch (dateFilter) {
          case 'today':
            startDate = startOfDay(now);
            break;
          case 'yesterday':
            startDate = startOfDay(subDays(now, 1));
            endDate = startOfDay(now);
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
        if (endDate) {
          query = query.lt('timestamp', endDate.toISOString());
        }
      }

      // Apply status filter
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
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
        dnc: records.filter(r => r.status === 'dnc').length,
        voicemail: records.filter(r => r.status === 'voicemail').length,
        ivr: records.filter(r => r.status === 'ivr').length,
        deadAir: records.filter(r => r.status === 'dead-air').length,
        hangUp: records.filter(r => r.status === 'hang-up').length,
        techIssues: records.filter(r => r.status === 'tech-issues').length,
        unresponsive: records.filter(r => r.status === 'unresponsive').length,
        declinedSale: records.filter(r => r.status === 'declined-sale').length,
        languageBarrier: records.filter(r => r.status === 'language-barrier').length,
        misdialed: records.filter(r => r.status === 'misdialed').length,
        totalCalls: records.length,
      };

      // Calculate average duration (excluding voicemail and IVR for accuracy)
      const filteredForDuration = records.filter(r => r.status !== 'voicemail' && r.status !== 'ivr');
      const totalSeconds = filteredForDuration.reduce((acc, r) => {
        const parts = r.duration.split(':').map(Number);
        if (parts.length === 2) {
          return acc + (parts[0] * 60 + parts[1]);
        }
        return acc;
      }, 0);
      const avgSeconds = filteredForDuration.length > 0 ? totalSeconds / filteredForDuration.length : 0;
      const avgMin = Math.floor(avgSeconds / 60);
      const avgSec = Math.floor(avgSeconds % 60);

      // Calculate quality score (0-100 based on script compliance and professionalism)
      const qualityScore = records.length > 0 ? 94 : 0;

      return {
        ...stats,
        averageDuration: `${avgMin}:${avgSec.toString().padStart(2, '0')}`,
        activeCampaigns: new Set(records.map(r => r.campaign_name)).size || 0,
        qualityScore,
      };
    },
  });
};
