import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AudioUploadProps {
  onUploadComplete: () => void;
}

export const AudioUpload = ({ onUploadComplete }: AudioUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/m4a'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload an audio file (WebM, WAV, MP3, OGG, M4A)",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        
        if (!base64Audio) {
          throw new Error('Failed to read audio file');
        }

        // Get audio duration
        const audio = new Audio(URL.createObjectURL(file));
        await new Promise((resolve) => {
          audio.onloadedmetadata = resolve;
        });
        
        const minutes = Math.floor(audio.duration / 60);
        const seconds = Math.floor(audio.duration % 60);
        const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Call edge function
        const { data, error } = await supabase.functions.invoke('transcribe-audio', {
          body: {
            audio: base64Audio,
            fileName: file.name,
            metadata: {
              duration: duration,
              callerId: '+1234567890' // Default, can be customized later
            }
          }
        });

        if (error) throw error;

        if (data.success) {
          toast({
            title: "Success!",
            description: "Audio file transcribed and analyzed successfully",
          });
          onUploadComplete();
        } else {
          throw new Error(data.error || 'Transcription failed');
        }
      };

      reader.onerror = () => {
        throw new Error('Failed to read file');
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process audio file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-full max-w-md">
            <label
              htmlFor="audio-upload"
              className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                uploading
                  ? 'border-muted bg-muted/20 cursor-not-allowed'
                  : 'border-border hover:border-primary bg-card hover:bg-muted/30'
              }`}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {uploading ? (
                  <Loader2 className="h-10 w-10 text-primary animate-spin mb-2" />
                ) : (
                  <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                )}
                <p className="mb-2 text-sm text-foreground font-medium">
                  {uploading ? 'Processing...' : 'Upload Audio File'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {uploading ? 'Transcribing and analyzing...' : 'WebM, WAV, MP3, OGG, or M4A'}
                </p>
              </div>
              <input
                id="audio-upload"
                type="file"
                className="hidden"
                accept="audio/*"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Upload a call recording to automatically transcribe and analyze it using AI
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
