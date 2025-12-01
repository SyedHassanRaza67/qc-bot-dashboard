import { useNavigate } from "react-router-dom";
import { Play, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CallRecord {
  id: string;
  timestamp: string;
  publisher: string;
  callerId: string;
  status: 'sale' | 'callback' | 'not-interested' | 'disqualified' | 'pending';
  agentName?: string;
  subDisposition: string;
  duration: string;
  campaignName: string;
  reason: string;
  summary: string;
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

export const CallRecordsTable = ({ records = [], loading }: CallRecordsTableProps) => {
  const navigate = useNavigate();

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
            <TableHead className="font-semibold uppercase text-xs">Timestamp</TableHead>
            <TableHead className="font-semibold uppercase text-xs">Publisher</TableHead>
            <TableHead className="font-semibold uppercase text-xs">Caller ID</TableHead>
            <TableHead className="font-semibold uppercase text-xs">Status</TableHead>
            <TableHead className="font-semibold uppercase text-xs">Sub-Disposition</TableHead>
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
              <TableCell className="font-mono text-sm">{record.timestamp}</TableCell>
              <TableCell>{record.publisher}</TableCell>
              <TableCell className="font-mono">{record.callerId}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  {getStatusBadge(record.status)}
                  {record.agentName && (
                    <div className="text-xs text-muted-foreground">{record.agentName}</div>
                  )}
                </div>
              </TableCell>
              <TableCell>{record.subDisposition}</TableCell>
              <TableCell className="font-mono">{record.duration}</TableCell>
              <TableCell>{record.campaignName}</TableCell>
              <TableCell className="max-w-[200px] truncate">{record.reason}</TableCell>
              <TableCell className="max-w-[250px] truncate">{record.summary}</TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/record/${record.id}`);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
