import { useState, memo, useCallback } from "react";
import { Eye, Copy, Download, Play, Square, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";

interface CallRecord {
  id: string;
  timestamp: string;
  leadId?: string;
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
  isProcessing?: boolean;
}

interface CallRecordsTableProps {
  records?: CallRecord[];
  loading?: boolean;
  onViewRecord?: (recordId: string) => void;
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onTranscribeRecord?: (recordId: string) => void;
  transcribingRecordId?: string | null;
}

const getStatusBadge = (status: string, summary?: string, isProcessing?: boolean) => {
  // Show "Processing Audio..." badge when recording is being processed
  if (isProcessing) {
    return (
      <span className="status-badge bg-purple-500/20 text-purple-400 border-purple-500/30 animate-pulse">
        Processing Audio...
      </span>
    );
  }
  
  // Show "Transcribing..." badge when actively being processed
  if (summary === 'Transcribing...') {
    return (
      <span className="status-badge bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse">
        Transcribing...
      </span>
    );
  }
  
  // Show "Pending" badge for records awaiting transcription
  if (summary === 'Pending AI analysis') {
    return (
      <span className="status-badge bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
        Pending
      </span>
    );
  }
  
  // Show error badge for failed transcriptions
  if (summary?.startsWith('AI error:') || summary?.startsWith('Audio fetch failed') || summary?.includes('failed')) {
    return (
      <span className="status-badge bg-red-500/20 text-red-400 border-red-500/30">
        Error
      </span>
    );
  }
  
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
          <span className="flex flex-col items-center gap-0.5 cursor-default">
            <span className="text-lg">{emoji}</span>
            <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Memoized table row component for performance
const TableRowMemo = memo(({ 
  record, 
  index, 
  startIndex,
  playingId, 
  onPlay, 
  onView, 
  onCopy, 
  onDownload,
  onTranscribe,
  transcribingRecordId
}: {
  record: CallRecord;
  index: number;
  startIndex: number;
  playingId: string | null;
  onPlay: (e: React.MouseEvent, recordingUrl?: string, id?: string, uploadSource?: string) => void;
  onView: (id: string) => void;
  onCopy: (e: React.MouseEvent, transcript?: string) => void;
  onDownload: (e: React.MouseEvent, recordingUrl?: string, id?: string) => void;
  onTranscribe?: (e: React.MouseEvent, id: string, summary?: string) => void;
  transcribingRecordId?: string | null;
}) => {
  const needsTranscription = record.summary === 'Pending AI analysis' || 
                              record.summary?.startsWith('AI error:') || 
                              record.summary?.startsWith('Audio fetch failed') ||
                              record.summary?.includes('failed');
  
  // Check if recording is known to be unavailable OR is still processing
  const isRecordingUnavailable = record.isProcessing ||
                                  record.summary === 'Recording not available on server' ||
                                  record.summary?.includes('Recording not available') ||
                                  !record.recordingUrl;
  
  const isThisRecordTranscribing = transcribingRecordId === record.id;
  
  return (
  <TableRow 
    className={`table-row cursor-pointer ${index % 2 === 0 ? 'bg-card' : 'bg-muted/30'}`}
    onClick={() => onView(record.id)}
  >
    <TableCell className="font-semibold text-primary">{startIndex + index + 1}</TableCell>
    <TableCell className="font-mono text-sm">{record.timestamp}</TableCell>
    <TableCell>
      <div className="flex items-center gap-1">
        <span className="font-mono text-sm">{record.leadId || '—'}</span>
        {record.leadId && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(record.leadId || '');
                    toast.success("Lead ID copied");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy Lead ID</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </TableCell>
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
      {getStatusBadge(record.status, record.summary, record.isProcessing)}
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
                disabled={isRecordingUnavailable}
                onClick={(e) => {
                  if (isRecordingUnavailable) {
                    e.stopPropagation();
                    toast.error("Recording not available on server");
                    return;
                  }
                  onPlay(e, record.recordingUrl, record.id, record.uploadSource);
                }}
              >
                {playingId === record.id ? (
                  <Square className="h-4 w-4 text-destructive" />
                ) : (
                  <Play className={`h-4 w-4 ${isRecordingUnavailable ? 'opacity-50' : ''}`} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{record.isProcessing ? "Audio Processing..." : isRecordingUnavailable ? "Recording Unavailable" : playingId === record.id ? "Stop Audio" : "Play Audio"}</p>
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
                  onView(record.id);
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
                onClick={(e) => onCopy(e, record.transcript)}
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
                onClick={(e) => onDownload(e, record.recordingUrl, record.id)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Download Audio</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {needsTranscription && onTranscribe && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!!transcribingRecordId}
                  onClick={(e) => onTranscribe(e, record.id, record.summary)}
                >
                  <RotateCw className={`h-4 w-4 text-amber-500 ${isThisRecordTranscribing ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isThisRecordTranscribing ? 'Transcribing...' : 'Retry Transcription'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </TableCell>
  </TableRow>
  );
});

TableRowMemo.displayName = 'TableRowMemo';

// Loading skeleton component
const TableSkeleton = () => (
  <div className="bg-card border border-border rounded-lg overflow-hidden">
    <div className="p-4 space-y-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  </div>
);

// Pagination component
const Pagination = ({ 
  currentPage, 
  totalPages, 
  totalCount, 
  onPageChange 
}: { 
  currentPage: number; 
  totalPages: number; 
  totalCount: number;
  onPageChange: (page: number) => void;
}) => {
  const pageSize = 50;
  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalCount);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      
      if (currentPage > 3) pages.push('...');
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (currentPage < totalPages - 2) pages.push('...');
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  return (
    <div className="flex items-center justify-between px-4 py-4 border-t border-border">
      <div className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{startRecord}</span> to{' '}
        <span className="font-medium text-foreground">{endRecord}</span> of{' '}
        <span className="font-medium text-foreground">{totalCount}</span> records
      </div>
      
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        
        <div className="flex items-center gap-1 mx-2">
          {getPageNumbers().map((page, idx) => (
            typeof page === 'number' ? (
              <Button
                key={idx}
                variant={currentPage === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(page)}
                className="min-w-[36px]"
              >
                {page}
              </Button>
            ) : (
              <span key={idx} className="px-2 text-muted-foreground">...</span>
            )
          ))}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="gap-1"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export const CallRecordsTable = ({ 
  records = [], 
  loading, 
  onViewRecord,
  currentPage = 1,
  totalPages = 1,
  totalCount = 0,
  onPageChange,
  onTranscribeRecord,
  transcribingRecordId
}: CallRecordsTableProps) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  
  const startIndex = (currentPage - 1) * 50;

  const handlePlayAudio = useCallback(async (e: React.MouseEvent, recordingUrl?: string, id?: string, uploadSource?: string) => {
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

    // For external URLs (HTTP/HTTPS), use proxy to avoid CORS/mixed content issues
    let audioUrl = recordingUrl;
    
    if (recordingUrl.startsWith('http://') || recordingUrl.startsWith('https://')) {
      // Use proxy edge function for external URLs
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        
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
          body: JSON.stringify({ url: recordingUrl }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          // Show user-friendly message for missing files
          if (response.status === 404) {
            throw new Error('Recording not available on server');
          }
          throw new Error(errorData.error || 'Failed to load audio');
        }
        
        const audioBlob = await response.blob();
        audioUrl = URL.createObjectURL(audioBlob);
      } catch (err) {
        console.error('Proxy error:', err);
        toast.error(err instanceof Error ? err.message : "Failed to load audio");
        return;
      }
    } else {
      // For Supabase storage paths, get signed URL
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
    audio.onended = () => {
      setPlayingId(null);
      setAudioElement(null);
      // Revoke blob URL if we created one
      if (audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
    };
    audio.onerror = () => {
      toast.error("Failed to play audio");
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
  }, [playingId, audioElement]);

  const handleCopyTranscript = useCallback((e: React.MouseEvent, transcript?: string) => {
    e.stopPropagation();
    if (transcript) {
      navigator.clipboard.writeText(transcript);
      toast.success("Transcript copied to clipboard");
    } else {
      toast.error("No transcript available");
    }
  }, []);

  const handleDownloadAudio = useCallback((e: React.MouseEvent, recordingUrl?: string, id?: string) => {
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
  }, []);

  const handleViewRecord = useCallback((id: string) => {
    onViewRecord?.(id);
  }, [onViewRecord]);

  const handleTranscribe = useCallback((e: React.MouseEvent, id: string, summary?: string) => {
    e.stopPropagation();
    onTranscribeRecord?.(id);
    toast.info("Starting transcription...");
  }, [onTranscribeRecord]);

  if (loading) {
    return <TableSkeleton />;
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
            <TableHead className="font-semibold uppercase text-xs">Lead ID</TableHead>
            <TableHead className="font-semibold uppercase text-xs">Agent ID</TableHead>
            <TableHead className="font-semibold uppercase text-xs">AI Status</TableHead>
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
            <TableRowMemo
              key={record.id}
              record={record}
              index={index}
              startIndex={startIndex}
              playingId={playingId}
              onPlay={handlePlayAudio}
              onView={handleViewRecord}
              onCopy={handleCopyTranscript}
              onDownload={handleDownloadAudio}
              onTranscribe={handleTranscribe}
              transcribingRecordId={transcribingRecordId}
            />
          ))}
        </TableBody>
      </Table>
      
      {onPageChange && totalPages > 1 && (
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
};
