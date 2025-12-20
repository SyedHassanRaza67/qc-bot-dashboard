import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Copy, Download, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CallRecord {
  id: string;
  timestamp: string;
  status: 'sale' | 'callback' | 'not-interested' | 'disqualified' | 'pending';
  dialerDisposition?: string;
  agentName?: string;
  subDisposition: string;
  agentResponse?: 'very-bad' | 'bad' | 'average' | 'good' | 'excellent';
  customerResponse?: 'very-bad' | 'bad' | 'average' | 'good' | 'excellent';
  duration: string;
  campaignName: string;
  reason: string;
  summary: string;
  transcript?: string;
  recordingUrl?: string;
  uploadSource?: string;
  agentId?: string;
}

interface CallRecordsTableProps {
  records?: CallRecord[];
  loading?: boolean;
}

const getStatusBadge = (status: string) => {
  const statusMap = {
    sale: 'status-sale',
    callback: 'status-callback',
    'not-interested': 'status-not-interested',
    disqualified: 'status-disqualified',
    pending: 'status-pending',
  };
  
  const displayMap = {
    sale: 'Sale',
    callback: 'Callback',
    'not-interested': 'Not Interested',
    disqualified: 'Disqualified',
    pending: 'Pending',
  };
  
  return (
    <span className={`status-badge ${statusMap[status as keyof typeof statusMap]}`}>
      {displayMap[status as keyof typeof displayMap]}
    </span>
  );
};

const getSentimentEmoji = (sentiment?: string) => {
  const sentimentMap: Record<string, { emoji: string; label: string }> = {
    'very-bad': { emoji: '😡', label: 'Very Bad' },
    'bad': { emoji: '😕', label: 'Bad' },
    'average': { emoji: '🙂', label: 'Average' },
    'good': { emoji: '😊', label: 'Good' },
    'excellent': { emoji: '😍', label: 'Excellent' },
  };
  
  if (!sentiment || !sentimentMap[sentiment]) {
    return <span className="text-muted-foreground">—</span>;
  }
  
  const { emoji, label } = sentimentMap[sentiment];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span className="text-lg cursor-default">{emoji}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const CallRecordsTable = ({ records = [], loading }: CallRecordsTableProps) => {
  const navigate = useNavigate();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const handlePlayAudio = async (e: React.MouseEvent, recordingUrl?: string, id?: string, uploadSource?: string) => {
    e.stopPropagation();
    
    if (!recordingUrl) {
      toast.error("No recording available");
      return;
    }

    // If currently playing this audio, stop it
    if (playingId === id && audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setPlayingId(null);
      setAudioElement(null);
      return;
    }

    // Stop any currently playing audio
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }

    // For VICIdial or external URLs, use directly; for Supabase storage, get signed URL
    let audioUrl = recordingUrl;
    
    // Check if it's a Supabase storage path (not an external URL)
    if (!recordingUrl.startsWith('http://') && !recordingUrl.startsWith('https://')) {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.functions.invoke('get-signed-url', {
          body: { storagePath: recordingUrl }
        });
        if (error || !data?.signedUrl) {
          toast.error("Failed to get audio URL");
          return;
        }
        audioUrl = data.signedUrl;
      } catch {
        toast.error("Failed to get audio URL");
        return;
      }
    }

    // Play audio
    const audio = new Audio(audioUrl);
    audio.crossOrigin = "anonymous";
    audio.onended = () => {
      setPlayingId(null);
      setAudioElement(null);
    };
    audio.onerror = () => {
      toast.error("Failed to play audio - check if URL is accessible");
      setPlayingId(null);
      setAudioElement(null);
    };
    
    try {
      await audio.play();
      setPlayingId(id || null);
      setAudioElement(audio);
    } catch (err) {
      toast.error("Failed to play audio");
    }
  };

  const handleCopyTranscript = (e: React.MouseEvent, transcript?: string) => {
    e.stopPropagation();
    if (transcript) {
      navigator.clipboard.writeText(transcript);
      toast.success("Transcript copied to clipboard");
    } else {
      toast.error("No transcript available");
    }
  };

  const handleDownloadAudio = (e: React.MouseEvent, recordingUrl?: string, id?: string) => {
    e.stopPropagation();
    if (recordingUrl) {
      const link = document.createElement('a');
      link.href = recordingUrl;
      link.download = `recording-${id}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started");
    } else {
      toast.error("No recording available");
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-3/4 mx-auto"></div>
          <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No records available yet</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <Table>
        <TableHeader className="table-header">
          <TableRow>
            <TableHead className="font-semibold uppercase text-xs w-16">Sr. No.</TableHead>
            <TableHead className="font-semibold uppercase text-xs">Timestamp</TableHead>
            <TableHead className="font-semibold uppercase text-xs">Agent ID</TableHead>
            <TableHead className="font-semibold uppercase text-xs">AI Status</TableHead>
            <TableHead className="font-semibold uppercase text-xs">Status</TableHead>
            <TableHead className="font-semibold uppercase text-xs">AI Sub-Disposition</TableHead>
            <TableHead className="font-semibold uppercase text-xs text-center">Agent Response</TableHead>
            <TableHead className="font-semibold uppercase text-xs text-center">Customer Response</TableHead>
            <TableHead className="font-semibold uppercase text-xs">Duration</TableHead>
            <TableHead className="font-semibold uppercase text-xs">Campaign</TableHead>
            <TableHead className="font-semibold uppercase text-xs">Reason</TableHead>
            <TableHead className="font-semibold uppercase text-xs">Summary</TableHead>
            <TableHead className="font-semibold uppercase text-xs text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record, index) => (
            <TableRow 
              key={record.id} 
              className={`table-row cursor-pointer ${index % 2 === 0 ? 'bg-card' : 'bg-muted/30'}`}
              onClick={() => navigate(`/record/${record.id}`)}
            >
              <TableCell className="font-semibold text-primary">{index + 1}</TableCell>
              <TableCell className="font-mono text-sm">{record.timestamp}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-sm">{record.agentName || record.agentId || '—'}</span>
                  {(record.agentName || record.agentId) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(record.agentName || record.agentId || '');
                              toast.success("Agent ID copied");
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copy Agent ID</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {getStatusBadge(record.status)}
              </TableCell>
              <TableCell>
                {record.dialerDisposition ? (
                  <span className="text-sm text-muted-foreground">{record.dialerDisposition}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>{record.subDisposition}</TableCell>
              <TableCell className="text-center">
                {getSentimentEmoji(record.agentResponse)}
              </TableCell>
              <TableCell className="text-center">
                {getSentimentEmoji(record.customerResponse)}
              </TableCell>
              <TableCell className="font-mono">{record.duration}</TableCell>
              <TableCell>{record.campaignName}</TableCell>
              <TableCell className="max-w-[150px] truncate">{record.reason}</TableCell>
              <TableCell className="max-w-[180px] truncate">{record.summary}</TableCell>
              <TableCell className="text-right">
                <div className="flex gap-1 justify-end">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => handlePlayAudio(e, record.recordingUrl, record.id, record.uploadSource)}
                        >
                          {playingId === record.id ? (
                            <Square className="h-4 w-4 text-destructive" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{playingId === record.id ? "Stop Audio" : "Play Audio"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/record/${record.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View Call Detail</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => handleCopyTranscript(e, record.transcript)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy Transcript</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => handleDownloadAudio(e, record.recordingUrl, record.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Download Audio</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
