import { useState, useRef, useEffect } from "react";
import { X, Download, Play, Pause, Phone, CheckCircle, Loader2, Mic, AlertCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallRecord } from "@/hooks/useCallRecords";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CallDetailDialogProps {
  recordId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CallDetailDialog = ({ recordId, open, onOpenChange }: CallDetailDialogProps) => {
  const queryClient = useQueryClient();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: record, isLoading } = useCallRecord(recordId || '');
  
  const isExternalUrl = record?.recordingUrl?.startsWith('http://') || record?.recordingUrl?.startsWith('https://');
  const storagePathForSignedUrl = isExternalUrl ? null : record?.recordingUrl || null;
  
  const { signedUrl, isLoading: urlLoading, error: urlError } = useSignedUrl(storagePathForSignedUrl);
  const audioUrl = isExternalUrl ? record?.recordingUrl : signedUrl;

  // Cleanup audio on close
  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [open]);

  // Auto-poll for pending transcriptions
  useEffect(() => {
    const isPending = record?.transcript === 'Pending transcription' || 
                      record?.summary === 'Transcribing...' ||
                      record?.summary === 'Pending AI analysis';
    
    if (!isPending || !recordId || !open) return;
    
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['call-record', recordId] });
    }, 5000);
    
    return () => clearInterval(interval);
  }, [record?.transcript, record?.summary, recordId, queryClient, open]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = async () => {
    if (!record?.recordingUrl) {
      toast.error("No recording available");
      return;
    }

    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    let finalAudioUrl = record.recordingUrl;
    
    if (isExternalUrl) {
      try {
        // Get the current session for auth token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast.error("Please log in to play audio");
          return;
        }
        
        const projectId = 'dxwowuztnmjewkncptji';
        const proxyUrl = `https://${projectId}.supabase.co/functions/v1/proxy-audio`;
        
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ url: record.recordingUrl }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 404) {
            throw new Error('Recording not available on server');
          }
          throw new Error(errorData.error || 'Failed to load audio');
        }
        
        const audioBlob = await response.blob();
        finalAudioUrl = URL.createObjectURL(audioBlob);
      } catch (err) {
        console.error('Audio proxy error:', err);
        toast.error(err instanceof Error ? err.message : "Failed to load audio");
        return;
      }
    } else if (signedUrl) {
      finalAudioUrl = signedUrl;
    } else {
      toast.error("Audio URL not available");
      return;
    }

    audioRef.current = new Audio(finalAudioUrl);
    
    audioRef.current.onloadedmetadata = () => setDuration(audioRef.current?.duration || 0);
    audioRef.current.ontimeupdate = () => setCurrentTime(audioRef.current?.currentTime || 0);
    audioRef.current.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    audioRef.current.onerror = () => {
      toast.error("Failed to load audio");
      setIsPlaying(false);
    };

    audioRef.current.play();
    setIsPlaying(true);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleDownload = () => {
    if (!audioUrl) {
      toast.error("No recording available");
      return;
    }

    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `call-recording-${record?.id || 'unknown'}.mp3`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Download started");
  };

  const getSentimentEmoji = (sentiment?: string) => {
    const emojis: Record<string, string> = {
      'excellent': '😍',
      'good': '😊',
      'average': '🙂',
      'bad': '😕',
      'very-bad': '😡',
    };
    return sentiment ? emojis[sentiment] || '—' : '—';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      sale: 'text-green-500',
      callback: 'text-yellow-500',
      'not-interested': 'text-red-500',
      disqualified: 'text-orange-500',
      pending: 'text-muted-foreground',
    };
    return colors[status] || 'text-muted-foreground';
  };

  const isPendingTranscription = record?.transcript === 'Pending transcription' || !record?.transcript;
  const isVicidialRecord = record?.uploadSource === 'vicidial';

  const handleTranscribe = async () => {
    if (!recordId) return;
    
    setIsTranscribing(true);
    toast.info('Starting AI transcription...');

    try {
      const { data, error } = await supabase.functions.invoke('transcribe-vicidial', {
        body: { call_record_id: recordId }
      });

      if (error) {
        toast.error(error.message || 'Transcription failed');
        return;
      }

      toast.success('Transcription completed!');
      queryClient.invalidateQueries({ queryKey: ['call-record', recordId] });
    } catch (err) {
      toast.error('Failed to transcribe');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCopyTranscript = () => {
    if (record?.transcript && record.transcript !== 'Pending transcription') {
      navigator.clipboard.writeText(record.transcript);
      toast.success("Transcript copied");
    }
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 bg-background/95 backdrop-blur-md border-border">
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <DialogTitle className="text-xl font-bold flex items-center gap-3">
            <Phone className="h-5 w-5 text-primary" />
            Call Detail
            {record && (
              <Badge variant="outline" className="ml-2 font-mono text-xs">
                {record.systemCallId}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground mt-2">Loading...</p>
            </div>
          ) : !record ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Record not found</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Top Section: Info Cards in a Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Basic Info */}
                <div className="bg-card rounded-lg border border-border p-4">
                  <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                    📋 Basic Info
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time</span>
                      <span className="font-mono">{record.timestamp}</span>
                    </div>
                    {record.leadId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Lead ID</span>
                        <span className="font-mono">{record.leadId}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone</span>
                      <span className="font-mono">{record.callerId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Campaign</span>
                      <span>{record.campaignName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Agent</span>
                      <span>{record.agentName || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-mono">{record.duration}</span>
                    </div>
                  </div>
                </div>

                {/* QC Info */}
                <div className="bg-card rounded-lg border border-border p-4">
                  <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                    🧠 QC Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AI Dispo</span>
                      <span className={`font-semibold capitalize ${getStatusColor(record.status)}`}>
                        {record.status.replace('-', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sub-Dispo</span>
                      <span>{record.subDisposition}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Agent</span>
                      <span className="text-xl">{getSentimentEmoji(record.agentResponse)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Customer</span>
                      <span className="text-xl">{getSentimentEmoji(record.customerResponse)}</span>
                    </div>
                  </div>
                </div>

                {/* AI Insights */}
                <div className="bg-card rounded-lg border border-border p-4">
                  <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                    🤖 AI Insights
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Reason</span>
                      <p className="mt-1">{record.reason}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Summary</span>
                      <p className="mt-1 bg-muted/30 rounded p-2 text-xs">{record.summary}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-green-500 text-xs">Compliance verified</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Audio Player */}
              <div className="bg-card rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">🎧 Call Recording</h3>
                {!isExternalUrl && urlLoading ? (
                  <div className="flex items-center justify-center gap-2 py-3 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                ) : !isExternalUrl && urlError ? (
                  <div className="text-destructive text-center py-3 text-sm">{urlError}</div>
                ) : audioUrl ? (
                  <div className="flex items-center gap-3">
                    <Button size="sm" onClick={handlePlayPause}>
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    
                    <div 
                      className="flex-1 h-2 bg-muted rounded-full overflow-hidden cursor-pointer"
                      onClick={handleProgressClick}
                    >
                      <div 
                        className="h-full bg-primary transition-all duration-100"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                    
                    <span className="font-mono text-xs text-muted-foreground min-w-[80px] text-right">
                      {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : record.duration}
                    </span>
                    
                    <Button size="sm" variant="outline" onClick={handleDownload}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-center py-3 text-sm">No recording available</div>
                )}
              </div>

              {/* Transcript */}
              <div className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    📝 Transcript
                    {isPendingTranscription ? (
                      <Badge variant="secondary" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    ) : (
                      <Badge variant="default" className="text-xs bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Done
                      </Badge>
                    )}
                  </h3>
                  <div className="flex gap-2">
                    {!isPendingTranscription && (
                      <Button size="sm" variant="ghost" onClick={handleCopyTranscript}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    {isPendingTranscription && isVicidialRecord && record.recordingUrl && (
                      <Button size="sm" onClick={handleTranscribe} disabled={isTranscribing}>
                        {isTranscribing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Mic className="h-4 w-4 mr-1" />
                            Transcribe
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                
                {isPendingTranscription ? (
                  <div className="bg-muted/30 rounded-lg p-4 text-center">
                    <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Not yet transcribed</p>
                    {isVicidialRecord && record.recordingUrl && (
                      <p className="text-xs text-muted-foreground mt-1">Click "Transcribe" to generate</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-muted/30 rounded-lg p-3 max-h-[200px] overflow-y-auto">
                    <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed">
                      {record.transcript}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
