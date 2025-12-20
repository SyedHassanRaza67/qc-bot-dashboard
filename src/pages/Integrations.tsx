import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Server, CheckCircle, XCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DialerIntegration {
  id: string;
  dialer_type: string;
  server_url: string;
  api_user: string;
  is_active: boolean;
  last_sync_at: string | null;
}

const Integrations = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [integration, setIntegration] = useState<DialerIntegration | null>(null);
  const [formData, setFormData] = useState({
    server_url: "",
    api_user: "",
    api_pass: "",
    is_active: true,
  });

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
          api_pass: "", // Don't show existing password
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

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        user_id: user.id,
        dialer_type: "vicidial",
        server_url: formData.server_url,
        api_user: formData.api_user,
        api_pass_encrypted: formData.api_pass || (integration ? "unchanged" : ""),
        is_active: formData.is_active,
      };

      if (integration) {
        // Update existing
        const updatePayload: Record<string, unknown> = {
          server_url: formData.server_url,
          api_user: formData.api_user,
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
        // Insert new
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
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("vici-sync", {
        body: { action: "test" },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Connection Successful",
          description: "VICIdial API connection is working",
        });
      } else {
        throw new Error(data?.error || "Connection test failed");
      }
    } catch (error) {
      console.error("Connection test failed:", error);
      toast({
        title: "Connection Failed",
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
        className="max-w-4xl mx-auto px-6"
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            Integrations
          </h1>
          <p className="text-muted-foreground">
            Configure your dialer connections to automatically sync call recordings
          </p>
        </div>

        {/* VICIdial Integration Card */}
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Server className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>VICIdial Integration</CardTitle>
                  <CardDescription>
                    Connect to your VICIdial server to sync call recordings
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {integration?.is_active ? (
                  <span className="flex items-center gap-1 text-sm text-green-500">
                    <CheckCircle className="h-4 w-4" />
                    Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <XCircle className="h-4 w-4" />
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Server URL */}
            <div className="space-y-2">
              <Label htmlFor="server_url">Server URL</Label>
              <Input
                id="server_url"
                placeholder="https://your-vicidial-server.com"
                value={formData.server_url}
                onChange={(e) => setFormData({ ...formData, server_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                The base URL of your VICIdial server (without /vicidial path)
              </p>
            </div>

            {/* API User */}
            <div className="space-y-2">
              <Label htmlFor="api_user">API Username</Label>
              <Input
                id="api_user"
                placeholder="api_user"
                value={formData.api_user}
                onChange={(e) => setFormData({ ...formData, api_user: e.target.value })}
              />
            </div>

            {/* API Password */}
            <div className="space-y-2">
              <Label htmlFor="api_pass">
                API Password {integration && "(leave blank to keep existing)"}
              </Label>
              <div className="relative">
                <Input
                  id="api_pass"
                  type={showPassword ? "text" : "password"}
                  placeholder={integration ? "••••••••" : "Enter API password"}
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

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <Label>Enable Auto-Sync</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically fetch new call recordings from VICIdial
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
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !integration}
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
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
