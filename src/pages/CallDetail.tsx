import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

const CallDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);

  // Mock data - replace with actual API call based on id
  const record = {
    id: id,
    timestamp: "2025-12-01 10:30:15",
    callerId: "+1234567890",
    campaignName: "Summer Campaign",
    publisher: "Publisher A",
    duration: "5:34",
    status: "sale",
    agentName: "John Doe",
    subDisposition: "Interested",
    reason: "Qualified lead with high intent to purchase",
    summary: "Customer expressed strong interest in product features and pricing. Asked detailed questions about warranty and delivery options. Ready to proceed with purchase pending final budget approval.",
    systemCallId: "SYS-2025-001234",
    publisherId: "PUB-A-789",
    buyerId: "BUY-X-456",
    recordingUrl: "#",
    transcript: `Agent: Good morning! Thank you for calling. My name is John. How can I help you today?

Customer: Hi John, I'm interested in learning more about your solar panel installation services.

Agent: Excellent! I'd be happy to help you with that. Can you tell me a bit about your property and what prompted your interest in solar energy?

Customer: Sure, I have a 2000 square foot home, and I'm looking to reduce my electricity bills. I've heard solar can really help with that.

Agent: Absolutely, solar panels can significantly reduce your energy costs. Based on your home size, we typically recommend a 6-8 kW system. This could reduce your electricity bill by 70-90%. 

Customer: That sounds great! What about the installation process and warranty?

Agent: The installation typically takes 1-2 days, and we provide a 25-year warranty on the panels and a 10-year warranty on the installation work. We also handle all the paperwork for government rebates and incentives.

Customer: Perfect. I need to discuss this with my spouse, but I'm very interested. Can we schedule a follow-up call for next week?

Agent: Of course! I'll send you our information package via email, and we can schedule a call for next Tuesday at 2 PM. Does that work for you?

Customer: Yes, that works perfectly. Thank you so much for your time, John!

Agent: My pleasure! Have a great day, and I look forward to speaking with you next week.`,
  };

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
                <div className="text-sm text-muted-foreground">Caller ID</div>
                <div className="font-mono font-medium">{record.callerId}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Campaign</div>
                <div className="font-medium">{record.campaignName}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Publisher</div>
                <div className="font-medium">{record.publisher}</div>
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
