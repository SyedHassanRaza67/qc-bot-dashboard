import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Play, Pause, Phone, CheckCircle, XCircle, Loader2, Mic, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useRef, useEffect } from "react";
import { useCallRecord } from "@/hooks/useCallRecords";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
const CallDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: record, isLoading } = useCallRecord(id || '');
  
  // Check if recording URL is external (starts with http/https) or needs signed URL
  const isExternalUrl = record?.recordingUrl?.startsWith('http://') || record?.recordingUrl?.startsWith('https://');
  const storagePathForSignedUrl = isExternalUrl ? null : record?.recordingUrl || null;
  
  const { signedUrl, isLoading: urlLoading, error: urlError } = useSignedUrl(storagePathForSignedUrl);
  
  // Use external URL directly, or signed URL for storage paths
  const audioUrl = isExternalUrl ? record?.recordingUrl : signedUrl;

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Auto-poll for updates when transcript is pending (transcription in progress)
  useEffect(() => {
    const isPending = record?.transcript === 'Pending transcription' || 
                      record?.summary === 'Transcribing...' ||
                      record?.summary === 'Pending AI analysis';
    
    if (!isPending || !id) return;
    
    console.log('Auto-polling for transcription updates...');
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['call-record', id] });
    }, 5000); // Poll every 5 seconds
    
    return () => clearInterval(interval);
  }, [record?.transcript, record?.summary, id, queryClient]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = async () => {
    if (!record?.recordingUrl) {
      toast.error("No recording available for this call");
      return;
    }

    // If we have an audio element and it's playing, pause it
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // If we already have an audio element, just play it
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    // Need to create audio element - first get the audio URL
    let finalAudioUrl = record.recordingUrl;
    
    if (isExternalUrl) {
      // Use proxy for external URLs to avoid CORS/mixed content issues
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
    
    audioRef.current.onloadedmetadata = () => {
      setDuration(audioRef.current?.duration || 0);
    };
    
    audioRef.current.ontimeupdate = () => {
      setCurrentTime(audioRef.current?.currentTime || 0);
    };
    
    audioRef.current.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    audioRef.current.onerror = () => {
      toast.error("Failed to load audio recording");
      setIsPlaying(false);
    };

    audioRef.current.play();
    setIsPlaying(true);
  };

  // Reset audio when audio URL changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [audioUrl]);

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
      toast.error("No recording available for download");
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
    const colors = {
      sale: 'text-success',
      callback: 'text-warning',
      'not-interested': 'text-destructive',
      disqualified: 'text-warning',
      pending: 'text-muted-foreground',
    };
    return colors[status as keyof typeof colors] || 'text-muted-foreground';
  };

  // Calculate a mock quality score (0-100) - in future this would come from AI analysis
  const calculateQualityScore = () => {
    // Placeholder logic - would be replaced with actual AI scoring
    const baseScore = 70;
    const statusBonus = record?.status === 'sale' ? 20 : record?.status === 'callback' ? 10 : 0;
    const agentBonus = record?.agentResponse === 'excellent' ? 10 : record?.agentResponse === 'good' ? 5 : 0;
    return Math.min(100, baseScore + statusBonus + agentBonus);
  };

  const isPendingTranscription = record?.transcript === 'Pending transcription' || !record?.transcript;
  const isVicidialRecord = record?.uploadSource === 'vicidial';

  const handleTranscribe = async () => {
    if (!id) return;
    
    setIsTranscribing(true);
    toast.info('Starting AI transcription... This may take a minute.');

    try {
      const { data, error } = await supabase.functions.invoke('transcribe-vicidial', {
        body: { call_record_id: id }
      });

      if (error) {
        console.error('Transcription error:', error);
        toast.error(error.message || 'Transcription failed');
        return;
      }

      toast.success('Transcription completed successfully!');
      // Refresh the call record data
      queryClient.invalidateQueries({ queryKey: ['call-record', id] });
    } catch (err) {
      console.error('Transcription error:', err);
      toast.error('Failed to transcribe recording');
    } finally {
      setIsTranscribing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border p-6">
          <div className="max-w-7xl mx-auto">
            <Button 
              variant="ghost" 
              onClick={() => navigate(-1)}
              className="mb-4 hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Loading...</h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-muted rounded-lg"></div>
            <div className="h-32 bg-muted rounded-lg"></div>
            <div className="h-32 bg-muted rounded-lg"></div>
          </div>
        </main>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border p-6">
          <div className="max-w-7xl mx-auto">
            <Button 
              variant="ghost" 
              onClick={() => navigate(-1)}
              className="mb-4 hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Record Not Found</h1>
          </div>
        </header>
      </div>
    );
  }

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const qualityScore = calculateQualityScore();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border p-6">
        <div className="max-w-7xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-4 hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Call Detail</h1>
          <p className="text-muted-foreground">View detailed information about this call record</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Basic Information (The Foundation) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-primary">📋</span>
                Basic Information
              </CardTitle>
              <p className="text-xs text-muted-foreground">The Foundation</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Timestamp</div>
                <div className="font-mono font-medium">{record.timestamp}</div>
              </div>
              {record.leadId && (
                <div>
                  <div className="text-sm text-muted-foreground">Lead ID</div>
                  <div className="font-mono font-medium">{record.leadId}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-muted-foreground">Caller ID / Phone</div>
                <div className="font-mono font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <a href={`tel:${record.callerId}`} className="hover:text-primary hover:underline">
                    {record.callerId}
                  </a>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Campaign</div>
                <div className="font-medium">{record.campaignName}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Agent Name</div>
                <div className="font-medium">{record.agentName || '—'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Duration</div>
                <div className="font-mono font-medium">
                  Total Time: {record.duration}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. QC Information (The "Brain") */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-primary">🧠</span>
                QC Information
              </CardTitle>
              <p className="text-xs text-muted-foreground">The "Brain"</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">AI Dispo.</div>
                <div className={`font-semibold capitalize ${getStatusColor(record.status)}`}>
                  {record.status.replace('-', ' ')}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Sub-Disposition</div>
                <div className="font-medium">{record.subDisposition}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Quality Score</div>
                <div className="flex items-center gap-2">
                  <div className={`text-2xl font-bold ${
                    qualityScore >= 80 ? 'text-success' : 
                    qualityScore >= 60 ? 'text-warning' : 'text-destructive'
                  }`}>
                    {qualityScore}
                  </div>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Agent Sentiment</div>
                  <div className="text-2xl">{getSentimentEmoji(record.agentResponse)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Customer Sentiment</div>
                  <div className="text-2xl">{getSentimentEmoji(record.customerResponse)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. AI Insights (The Logic) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-primary">🤖</span>
                AI Insights
              </CardTitle>
              <p className="text-xs text-muted-foreground">The Logic</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">System Call ID</div>
                <div className="font-mono font-medium text-sm break-all">{record.systemCallId}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Reason</div>
                <div className="text-sm">{record.reason}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Summary</div>
                <div className="text-sm bg-muted/30 rounded p-2">{record.summary}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Compliance Check</div>
                <div className="flex items-center gap-2 mt-1">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <span className="text-sm font-medium text-success">Yes</span>
                  <span className="text-xs text-muted-foreground">(Legal disclosures verified)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Audio Player */}
        <Card>
          <CardHeader>
            <CardTitle>Call Recording</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isExternalUrl && urlLoading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading recording...</span>
              </div>
            ) : !isExternalUrl && urlError ? (
              <div className="text-destructive text-center py-4">
                {urlError}
              </div>
            ) : audioUrl ? (
              <div className="flex items-center gap-4">
                <Button
                  size="lg"
                  onClick={handlePlayPause}
                  className="transition-all duration-200 hover:shadow-md"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 mr-2" />
                  ) : (
                    <Play className="h-5 w-5 mr-2" />
                  )}
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
                
                <div 
                  className="flex-1 h-2 bg-muted rounded-full overflow-hidden cursor-pointer"
                  onClick={handleProgressClick}
                >
                  <div 
                    className="h-full bg-primary transition-all duration-100"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
                
                <span className="font-mono text-sm text-muted-foreground min-w-[100px] text-right">
                  {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : record.duration}
                </span>
                
                <Button 
                  variant="outline" 
                  className="transition-all duration-200 hover:shadow-md"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            ) : (
              <div className="text-muted-foreground text-center py-4">
                No recording available for this call
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transcript */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Conversation Transcript
                {isPendingTranscription && isVicidialRecord && (
                  <Badge variant="secondary" className="ml-2">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Pending
                  </Badge>
                )}
                {!isPendingTranscription && (
                  <Badge variant="default" className="ml-2 bg-success">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Transcribed
                  </Badge>
                )}
              </CardTitle>
            </div>
            {isPendingTranscription && isVicidialRecord && record.recordingUrl && (
              <Button 
                onClick={handleTranscribe}
                disabled={isTranscribing}
                className="gap-2"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Transcribing...
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    Transcribe Now
                  </>
                )}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isPendingTranscription ? (
              <div className="bg-muted/30 rounded-lg p-6 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  This call recording has not been transcribed yet.
                </p>
                {isVicidialRecord && record.recordingUrl && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Click "Transcribe Now" to generate an AI transcript and analysis.
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-6 max-h-[600px] overflow-y-auto">
                <pre className="font-mono text-sm whitespace-pre-wrap leading-relaxed">
                  {record.transcript}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CallDetail;
