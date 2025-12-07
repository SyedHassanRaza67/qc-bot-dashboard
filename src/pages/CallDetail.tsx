import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useCallRecord } from "@/hooks/useCallRecords";

const CallDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);

  const { data: record, isLoading } = useCallRecord(id || '');

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

  const getStatusColor = (status: string) => {
    const colors = {
      sale: 'text-success',
      callback: 'text-warning',
      'not-interested': 'text-destructive',
      disqualified: 'text-warning',
    };
    return colors[status as keyof typeof colors] || 'text-muted-foreground';
  };

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
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Timestamp</div>
                <div className="font-mono font-medium">{record.timestamp}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Campaign</div>
                <div className="font-medium">{record.campaignName}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Publisher ID</div>
                <div className="font-mono font-medium">{record.publisherId}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Duration</div>
                <div className="font-mono font-medium">{record.duration}</div>
              </div>
            </CardContent>
          </Card>

          {/* QC Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">QC Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className={`font-semibold capitalize ${getStatusColor(record.status)}`}>
                  {record.status.replace('-', ' ')}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Agent Name</div>
                <div className="font-medium">{record.agentName}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Sub-Disposition</div>
                <div className="font-medium">{record.subDisposition}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Reason</div>
                <div className="text-sm">{record.reason}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Summary</div>
                <div className="text-sm">{record.summary}</div>
              </div>
            </CardContent>
          </Card>

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">System Call ID</div>
                <div className="font-mono font-medium text-sm">{record.systemCallId}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Publisher ID</div>
                <div className="font-mono font-medium text-sm">{record.publisherId}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Buyer ID</div>
                <div className="font-mono font-medium text-sm">{record.buyerId}</div>
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
            <div className="flex items-center gap-4">
              <Button
                size="lg"
                onClick={() => setIsPlaying(!isPlaying)}
                className="transition-all duration-200 hover:shadow-md"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5 mr-2" />
                ) : (
                  <Play className="h-5 w-5 mr-2" />
                )}
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary w-1/3 transition-all duration-300"></div>
              </div>
              
              <span className="font-mono text-sm text-muted-foreground">1:52 / 5:34</span>
              
              <Button variant="outline" className="transition-all duration-200 hover:shadow-md">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transcript */}
        <Card>
          <CardHeader>
            <CardTitle>Conversation Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/30 rounded-lg p-6 max-h-[600px] overflow-y-auto">
              <pre className="font-mono text-sm whitespace-pre-wrap leading-relaxed">
                {record.transcript}
              </pre>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CallDetail;
