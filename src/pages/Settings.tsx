import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  Settings as SettingsIcon, 
  Trash2, 
  Calendar, 
  Download, 
  RefreshCw, 
  AlertTriangle,
  Database,
  Monitor,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DateRange } from "react-day-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Storage keys
const STORAGE_KEYS = {
  sourceFilter: 'dashboard-source-filter',
  statusFilter: 'dashboard-status-filter',
  recordsPerPage: 'dashboard-records-per-page',
  defaultDateFilter: 'dashboard-default-date-filter',
};

const Settings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteByDateRange, setDeleteByDateRange] = useState<DateRange | undefined>();
  const [recordsPerPage, setRecordsPerPage] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.recordsPerPage) || "25";
  });
  const [defaultDateFilter, setDefaultDateFilter] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.defaultDateFilter) || "today";
  });
  const [callCount, setCallCount] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  useEffect(() => {
    const fetchCallCount = async () => {
      if (!user) return;
      
      setIsLoadingCount(true);
      const { count, error } = await supabase
        .from('call_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      if (!error) {
        setCallCount(count);
      }
      setIsLoadingCount(false);
    };

    if (user) {
      fetchCallCount();
    }
  }, [user]);

  // Clear all call records
  const handleClearAllCalls = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('call_records')
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      toast.success('All call records deleted', {
        description: `Removed ${callCount} records from database`,
      });
      setCallCount(0);
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete records');
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete by date range
  const handleDeleteByDateRange = async () => {
    if (!user || !deleteByDateRange?.from || !deleteByDateRange?.to) {
      toast.error('Please select a date range');
      return;
    }
    
    setIsDeleting(true);
    try {
      const fromDate = deleteByDateRange.from.toISOString();
      const toDate = new Date(deleteByDateRange.to);
      toDate.setHours(23, 59, 59, 999);
      
      const { error, count } = await supabase
        .from('call_records')
        .delete()
        .eq('user_id', user.id)
        .gte('timestamp', fromDate)
        .lte('timestamp', toDate.toISOString());
      
      if (error) throw error;
      
      toast.success('Records deleted', {
        description: `Removed records from selected date range`,
      });
      
      // Refresh count
      const { count: newCount } = await supabase
        .from('call_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      setCallCount(newCount);
      setDeleteByDateRange(undefined);
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete records');
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete by source
  const handleDeleteBySource = async (source: 'manual' | 'vicidial') => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('call_records')
        .delete()
        .eq('user_id', user.id)
        .eq('upload_source', source);
      
      if (error) throw error;
      
      toast.success(`${source === 'manual' ? 'Manual uploads' : 'VICIdial records'} deleted`);
      
      // Refresh count
      const { count: newCount } = await supabase
        .from('call_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      setCallCount(newCount);
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete records');
    } finally {
      setIsDeleting(false);
    }
  };

  // Clear screen / Reset view
  const handleResetView = () => {
    localStorage.removeItem(STORAGE_KEYS.sourceFilter);
    localStorage.removeItem(STORAGE_KEYS.statusFilter);
    toast.success('View reset', {
      description: 'All filters cleared. Redirecting to dashboard...',
    });
    setTimeout(() => {
      navigate('/dashboard');
    }, 500);
  };

  // Save display preferences
  const handleSaveRecordsPerPage = (value: string) => {
    setRecordsPerPage(value);
    localStorage.setItem(STORAGE_KEYS.recordsPerPage, value);
    toast.success('Records per page updated');
  };

  const handleSaveDefaultDateFilter = (value: string) => {
    setDefaultDateFilter(value);
    localStorage.setItem(STORAGE_KEYS.defaultDateFilter, value);
    toast.success('Default date filter updated');
  };

  // Export data
  const handleExportData = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('call_records')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.info('No records to export');
        return;
      }
      
      // Convert to CSV
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(record => 
        Object.values(record).map(v => 
          typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v
        ).join(',')
      );
      const csv = [headers, ...rows].join('\n');
      
      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-records-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Export complete', {
        description: `Exported ${data.length} records`,
      });
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export data');
    }
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-4xl mx-auto px-6"
      >
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/20">
              <SettingsIcon className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          </div>
          <p className="text-muted-foreground">Manage your data, preferences, and account</p>
        </div>

        <div className="space-y-6">
          {/* Data Management Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle>Data Management</CardTitle>
              </div>
              <CardDescription>
                Manage your call records data. Total records: {isLoadingCount ? '...' : callCount ?? 0}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Clear All Calls */}
              <div className="flex items-center justify-between p-4 border border-border rounded-xl">
                <div>
                  <h4 className="font-medium text-foreground">Clear All Call Records</h4>
                  <p className="text-sm text-muted-foreground">Permanently delete all your call records</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2" disabled={isDeleting || callCount === 0}>
                      <Trash2 className="h-4 w-4" />
                      Clear All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete all call records?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all {callCount} call records. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearAllCalls} className="bg-destructive text-destructive-foreground">
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Delete by Date Range */}
              <div className="p-4 border border-border rounded-xl space-y-4">
                <div>
                  <h4 className="font-medium text-foreground">Delete by Date Range</h4>
                  <p className="text-sm text-muted-foreground">Select a date range to delete records</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <DateRangePicker
                    dateRange={deleteByDateRange}
                    onDateRangeChange={setDeleteByDateRange}
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        className="gap-2"
                        disabled={!deleteByDateRange?.from || !deleteByDateRange?.to || isDeleting}
                      >
                        <Calendar className="h-4 w-4" />
                        Delete Range
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete records in date range?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all records between the selected dates. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteByDateRange} className="bg-destructive text-destructive-foreground">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Delete by Source */}
              <div className="p-4 border border-border rounded-xl space-y-4">
                <div>
                  <h4 className="font-medium text-foreground">Delete by Source</h4>
                  <p className="text-sm text-muted-foreground">Delete records from a specific source</p>
                </div>
                <div className="flex gap-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="gap-2" disabled={isDeleting}>
                        <Trash2 className="h-4 w-4" />
                        Manual Uploads
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete manual uploads?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all manually uploaded records. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteBySource('manual')} className="bg-destructive text-destructive-foreground">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="gap-2" disabled={isDeleting}>
                        <Trash2 className="h-4 w-4" />
                        VICIdial Records
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete VICIdial records?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all VICIdial synced records. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteBySource('vicidial')} className="bg-destructive text-destructive-foreground">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Export Data */}
              <div className="flex items-center justify-between p-4 border border-border rounded-xl">
                <div>
                  <h4 className="font-medium text-foreground">Export Data</h4>
                  <p className="text-sm text-muted-foreground">Download all your call records as CSV</p>
                </div>
                <Button variant="outline" className="gap-2" onClick={handleExportData}>
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Display Preferences Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                <CardTitle>Display Preferences</CardTitle>
              </div>
              <CardDescription>Customize how data is displayed on the dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Reset View */}
              <div className="flex items-center justify-between p-4 border border-border rounded-xl">
                <div>
                  <h4 className="font-medium text-foreground">Reset View</h4>
                  <p className="text-sm text-muted-foreground">Clear all filters and reset dashboard to defaults</p>
                </div>
                <Button variant="outline" className="gap-2" onClick={handleResetView}>
                  <RefreshCw className="h-4 w-4" />
                  Reset Filters
                </Button>
              </div>

              {/* Records Per Page */}
              <div className="flex items-center justify-between p-4 border border-border rounded-xl">
                <div>
                  <h4 className="font-medium text-foreground">Records Per Page</h4>
                  <p className="text-sm text-muted-foreground">Number of records to show per page</p>
                </div>
                <Select value={recordsPerPage} onValueChange={handleSaveRecordsPerPage}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Default Date Filter */}
              <div className="flex items-center justify-between p-4 border border-border rounded-xl">
                <div>
                  <h4 className="font-medium text-foreground">Default Date Filter</h4>
                  <p className="text-sm text-muted-foreground">Default date range when opening dashboard</p>
                </div>
                <Select value={defaultDateFilter} onValueChange={handleSaveDefaultDateFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="7days">Last 7 Days</SelectItem>
                    <SelectItem value="30days">Last 30 Days</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Account Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>Account</CardTitle>
              </div>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Info */}
              <div className="p-4 border border-border rounded-xl">
                <div className="space-y-2">
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="text-foreground font-medium">{user?.email || 'Loading...'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">User ID</Label>
                    <p className="text-foreground font-mono text-sm">{user?.id || 'Loading...'}</p>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="p-4 border border-destructive/50 rounded-xl bg-destructive/5">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <h4 className="font-medium text-destructive">Danger Zone</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete your account and all associated data. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={async () => {
                          try {
                            const { error } = await supabase.functions.invoke('delete-user', {
                              body: { userId: user?.id }
                            });
                            if (error) throw error;
                            await supabase.auth.signOut();
                            navigate('/');
                            toast.success('Account deleted');
                          } catch (err) {
                            toast.error('Failed to delete account');
                          }
                        }}
                        className="bg-destructive text-destructive-foreground"
                      >
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
};

export default Settings;
