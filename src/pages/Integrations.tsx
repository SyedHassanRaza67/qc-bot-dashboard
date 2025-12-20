import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  Settings, Server, CheckCircle, XCircle, Loader2, Eye, EyeOff, 
  Link2, Users, Calendar, Shield, Zap, AlertTriangle, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DialerIntegration {
  id: string;
  dialer_type: string;
  server_url: string;
  api_user: string;
  agent_user: string | null;
  is_active: boolean;
  last_sync_at: string | null;
}

interface ParsedUrlParams {
  host: string;
  user: string;
  pass: string;
  agent: string;
}

const Integrations = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [validatingIds, setValidatingIds] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // URL Parser
  const [importUrl, setImportUrl] = useState("");
  const [parsedParams, setParsedParams] = useState<ParsedUrlParams | null>(null);
  const [parseError, setParseError] = useState("");
  
  // Date Sync Mode
  const [realtimeMode, setRealtimeMode] = useState(true);
  const [syncDate, setSyncDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [integration, setIntegration] = useState<DialerIntegration | null>(null);
  const [formData, setFormData] = useState({
    server_url: "",
    api_user: "",
    api_pass: "",
    agent_user: "",
    is_active: true,
  });

  // Agent IDs processing
  const processedAgentIds = useMemo(() => {
    const raw = formData.agent_user.trim();
    if (!raw) return { formatted: "", ids: [], count: 0, duplicates: [] };
    
    // Split by comma, space, or newline
    const ids = raw.split(/[,\s\n]+/).filter(id => id.trim());
    const uniqueIds = [...new Set(ids)];
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    
    return {
      formatted: uniqueIds.join(", "),
      ids: uniqueIds,
      count: uniqueIds.length,
      duplicates: [...new Set(duplicates)]
    };
  }, [formData.agent_user]);

  // Parse URL function
  const parseDialerUrl = (url: string) => {
    setParseError("");
    setParsedParams(null);
    
    if (!url.trim()) return;
    
    try {
      // Extract host/server
      const hostMatch = url.match(/https?:\/\/([^\/]+)/i);
      const host = hostMatch ? hostMatch[0] : "";
      
      // Universal regex patterns for common parameter names
      const userPatterns = [
        /[?&]user=([^&\s]+)/i,
        /[?&]api_user=([^&\s]+)/i,
        /[?&]username=([^&\s]+)/i,
        /[?&]apiuser=([^&\s]+)/i,
      ];
      
      const passPatterns = [
        /[?&]pass=([^&\s]+)/i,
        /[?&]password=([^&\s]+)/i,
        /[?&]api_pass=([^&\s]+)/i,
        /[?&]apipass=([^&\s]+)/i,
      ];
      
      const agentPatterns = [
        /[?&]agent_user=([^&\s]+)/i,
        /[?&]agent=([^&\s]+)/i,
        /[?&]agentuser=([^&\s]+)/i,
        /[?&]agent_id=([^&\s]+)/i,
      ];
      
      let user = "";
      let pass = "";
      let agent = "";
      
      for (const pattern of userPatterns) {
        const match = url.match(pattern);
        if (match) { user = match[1]; break; }
      }
      
      for (const pattern of passPatterns) {
        const match = url.match(pattern);
        if (match) { pass = match[1]; break; }
      }
      
      for (const pattern of agentPatterns) {
        const match = url.match(pattern);
        if (match) { agent = match[1]; break; }
      }
      
      if (!host) {
        setParseError("Could not extract server URL from the link");
        return;
      }
      
      const parsed = { host, user, pass, agent };
      setParsedParams(parsed);
      
      toast({
        title: "URL Parsed Successfully",
        description: `Found ${user ? 'user, ' : ''}${pass ? 'password, ' : ''}${agent ? 'agent' : ''} parameters`,
      });
    } catch (error) {
      setParseError("Failed to parse URL. Please check the format.");
    }
  };

  const applyParsedParams = () => {
    if (!parsedParams) return;
    
    setFormData(prev => ({
      ...prev,
      server_url: parsedParams.host || prev.server_url,
      api_user: parsedParams.user || prev.api_user,
      api_pass: parsedParams.pass || prev.api_pass,
      agent_user: parsedParams.agent || prev.agent_user,
    }));
    
    setImportUrl("");
    setParsedParams(null);
    
    toast({
      title: "Parameters Applied",
      description: "Form fields updated with parsed values",
    });
  };

  // Validate server URL
  const isValidServerUrl = (url: string) => {
    if (!url) return { valid: false, message: "" };
    
    // Check for IP or domain
    const ipPattern = /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
    const domainPattern = /^https?:\/\/[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)+(:\d+)?$/;
    
    if (ipPattern.test(url) || domainPattern.test(url)) {
      return { valid: true, message: "Valid server address" };
    }
    
    // Check if it's just missing http
    if (/^(\d{1,3}\.){3}\d{1,3}/.test(url) || /^[a-zA-Z0-9]/.test(url)) {
      return { valid: false, message: "Add http:// or https:// prefix" };
    }
    
    return { valid: false, message: "Invalid server URL format" };
  };

  const serverValidation = useMemo(() => isValidServerUrl(formData.server_url), [formData.server_url]);

  // Handle agent ID input with auto-formatting
  const handleAgentIdChange = (value: string) => {
    // Auto-add comma after each complete ID (when space is detected)
    const formatted = value.replace(/(\d+)\s+(?=\d)/g, '$1, ');
    setFormData({ ...formData, agent_user: formatted });
  };

  const validateAgentIds = () => {
    setValidatingIds(true);
    
    setTimeout(() => {
      if (processedAgentIds.duplicates.length > 0) {
        toast({
          title: "Duplicates Found",
          description: `Removed ${processedAgentIds.duplicates.length} duplicate ID(s): ${processedAgentIds.duplicates.join(", ")}`,
          variant: "destructive",
        });
        // Auto-fix by applying unique IDs
        setFormData(prev => ({ ...prev, agent_user: processedAgentIds.formatted }));
      } else {
        toast({
          title: "Validation Passed",
          description: `All ${processedAgentIds.count} agent ID(s) are unique`,
        });
      }
      setValidatingIds(false);
    }, 500);
  };

  useEffect(() => {
    fetchIntegration();
  }, []);

  const fetchIntegration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("dialer_integrations")
        .select("*")
        .eq("user_id", user.id)
        .eq("dialer_type", "vicidial")
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setIntegration(data);
        setFormData({
          server_url: data.server_url,
          api_user: data.api_user,
          api_pass: "",
          agent_user: data.agent_user || "",
          is_active: data.is_active,
        });
      }
    } catch (error) {
      console.error("Error fetching integration:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.server_url || !formData.api_user) {
      toast({
        title: "Validation Error",
        description: "Server URL and API User are required",
        variant: "destructive",
      });
      return;
    }

    if (!serverValidation.valid) {
      toast({
        title: "Invalid Server URL",
        description: serverValidation.message,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        user_id: user.id,
        dialer_type: "vicidial",
        server_url: formData.server_url.replace(/\/$/, ''),
        api_user: formData.api_user,
        api_pass_encrypted: formData.api_pass || (integration ? "unchanged" : ""),
        agent_user: processedAgentIds.formatted || null,
        is_active: formData.is_active,
      };

      if (integration) {
        const updatePayload: Record<string, unknown> = {
          server_url: formData.server_url.replace(/\/$/, ''),
          api_user: formData.api_user,
          agent_user: processedAgentIds.formatted || null,
          is_active: formData.is_active,
        };
        if (formData.api_pass) {
          updatePayload.api_pass_encrypted = formData.api_pass;
        }

        const { error } = await supabase
          .from("dialer_integrations")
          .update(updatePayload)
          .eq("id", integration.id);

        if (error) throw error;
      } else {
        if (!formData.api_pass) {
          toast({
            title: "Validation Error",
            description: "API Password is required for new integrations",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }

        const { error } = await supabase
          .from("dialer_integrations")
          .insert(payload);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Integration settings saved successfully",
      });
      
      fetchIntegration();
    } catch (error) {
      console.error("Error saving integration:", error);
      toast({
        title: "Error",
        description: "Failed to save integration settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!formData.server_url || !formData.api_user) {
      toast({
        title: "Missing Fields",
        description: "Please fill in Server URL and API User first",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("vici-sync", {
        body: { action: "test" },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "✓ Connection Successful",
          description: "VICIdial API connection verified successfully!",
        });
      } else {
        throw new Error(data?.error || "Connection test failed");
      }
    } catch (error) {
      console.error("Connection test failed:", error);
      toast({
        title: "✗ Connection Failed",
        description: error instanceof Error ? error.message : "Could not connect to VICIdial API",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto px-6 space-y-6"
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            Smart Dialer Bridge
          </h1>
          <p className="text-muted-foreground">
            Universal call center integration - Import from any dialer API
          </p>
        </div>

        {/* Universal Link Importer */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Universal Link Importer</CardTitle>
                <CardDescription>
                  Paste any Call Center API URL to auto-detect credentials
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste your dialer API URL here...&#10;Example: http://138.201.244.63/vicidial/non_agent_api.php?source=test&function=recording_lookup&user=676767&pass=test1234&agent_user=25006"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              className="font-mono text-sm min-h-[80px]"
            />
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => parseDialerUrl(importUrl)}
                disabled={!importUrl.trim()}
              >
                <Zap className="h-4 w-4 mr-2" />
                Parse URL
              </Button>
              
              {parsedParams && (
                <Button onClick={applyParsedParams}>
                  <Check className="h-4 w-4 mr-2" />
                  Apply to Form
                </Button>
              )}
            </div>

            {parseError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" />
                {parseError}
              </div>
            )}

            {parsedParams && (
              <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-background border border-border">
                <div>
                  <span className="text-xs text-muted-foreground">Server</span>
                  <p className="font-mono text-sm truncate">{parsedParams.host || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">User</span>
                  <p className="font-mono text-sm">{parsedParams.user || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Password</span>
                  <p className="font-mono text-sm">{parsedParams.pass ? "••••••" : "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Agent</span>
                  <p className="font-mono text-sm">{parsedParams.agent || "—"}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Integration Card */}
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Server className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Dialer Configuration</CardTitle>
                  <CardDescription>
                    Configure your dialer connection settings
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {integration?.is_active ? (
                  <Badge variant="outline" className="border-green-500 text-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-muted-foreground text-muted-foreground">
                    <XCircle className="h-3 w-3 mr-1" />
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Server URL with validation */}
            <div className="space-y-2">
              <Label htmlFor="server_url" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Server URL
              </Label>
              <div className="relative">
                <Input
                  id="server_url"
                  placeholder="http://138.201.244.63"
                  value={formData.server_url}
                  onChange={(e) => setFormData({ ...formData, server_url: e.target.value })}
                  className={formData.server_url ? (serverValidation.valid ? "border-green-500" : "border-destructive") : ""}
                />
                {formData.server_url && (
                  <div className={`absolute right-3 top-1/2 -translate-y-1/2 ${serverValidation.valid ? "text-green-500" : "text-destructive"}`}>
                    {serverValidation.valid ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </div>
                )}
              </div>
              <p className={`text-xs ${serverValidation.valid ? "text-green-500" : "text-muted-foreground"}`}>
                {formData.server_url ? serverValidation.message : "Your dialer server IP or domain (e.g., http://138.201.244.63)"}
              </p>
            </div>

            {/* Agent IDs with counter and validation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="agent_user" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Agent IDs
                </Label>
                {processedAgentIds.count > 0 && (
                  <Badge className="bg-green-500 hover:bg-green-600 text-white">
                    Total Agents: {processedAgentIds.count}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  id="agent_user"
                  placeholder="25006, 25007, 25008"
                  value={formData.agent_user}
                  onChange={(e) => handleAgentIdChange(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  onClick={validateAgentIds}
                  disabled={validatingIds || processedAgentIds.count === 0}
                >
                  {validatingIds ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Validate IDs"
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter agent IDs separated by commas or spaces. Auto-formats as you type.
              </p>
            </div>

            {/* Date Sync Mode Toggle */}
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <Label>Date Sync Mode</Label>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${!realtimeMode ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    Historical
                  </span>
                  <Switch
                    checked={realtimeMode}
                    onCheckedChange={setRealtimeMode}
                  />
                  <span className={`text-sm ${realtimeMode ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    Real-time
                  </span>
                </div>
              </div>
              
              {!realtimeMode && (
                <div className="pt-2">
                  <Label htmlFor="sync_date" className="text-sm">Sync Date</Label>
                  <Input
                    id="sync_date"
                    type="date"
                    value={syncDate}
                    onChange={(e) => setSyncDate(e.target.value)}
                    className="mt-1 w-48"
                  />
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                {realtimeMode 
                  ? "Syncs today's recordings automatically" 
                  : "Syncs recordings from the selected date"}
              </p>
            </div>

            {/* API Credentials Group */}
            <div className="rounded-lg border border-border p-4 space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                API Credentials
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="api_user">API User</Label>
                  <Input
                    id="api_user"
                    placeholder="676767"
                    value={formData.api_user}
                    onChange={(e) => setFormData({ ...formData, api_user: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="api_pass">
                    API Password
                    {integration && (
                      <span className="text-xs text-muted-foreground ml-2">(blank = use stored)</span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="api_pass"
                      type={showPassword ? "text" : "password"}
                      placeholder={integration ? "••••••••" : "Enter password"}
                      value={formData.api_pass}
                      onChange={(e) => setFormData({ ...formData, api_pass: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <Label>Enable Auto-Sync</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically fetch new call recordings
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            {/* Last Sync Info */}
            {integration?.last_sync_at && (
              <p className="text-sm text-muted-foreground">
                Last synced: {new Date(integration.last_sync_at).toLocaleString()}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !formData.server_url || !formData.api_user}
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
              
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Integrations;
