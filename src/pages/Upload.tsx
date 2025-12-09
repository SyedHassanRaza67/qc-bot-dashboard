import { useState } from "react";
import { motion } from "framer-motion";
import { Upload as UploadIcon, Loader2, AudioWaveform, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const Upload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/m4a', 'audio/x-m4a'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload an audio file (WebM, WAV, MP3, OGG, M4A)",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadSuccess(false);

    try {
      // Convert file to base64
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result?.toString().split(',')[1];
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Failed to read audio file'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      // Get audio duration
      const duration = await new Promise<string>((resolve) => {
        const audio = new Audio(URL.createObjectURL(file));
        audio.onloadedmetadata = () => {
          const minutes = Math.floor(audio.duration / 60);
          const seconds = Math.floor(audio.duration % 60);
          resolve(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        };
        audio.onerror = () => resolve('0:00');
      });

      console.log('Uploading audio file:', file.name, 'Duration:', duration);

      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audio: base64Audio,
          fileName: file.name,
          metadata: {
            duration: duration,
            callerId: '+1234567890'
          }
        }
      });

      console.log('Edge function response:', data, error);

      if (error) {
        throw new Error(error.message || 'Failed to process audio');
      }

      if (data?.success) {
        setUploadSuccess(true);
        toast({
          title: "Success!",
          description: "Audio file transcribed and analyzed successfully",
        });
        
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        throw new Error(data?.error || 'Transcription failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process audio file",
        variant: "destructive",
      });
      setUploading(false);
    } finally {
      // Reset input
      event.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Upload Your Audio
          </h1>
          <p className="text-lg text-muted-foreground">
            Upload a call recording to automatically transcribe and analyze it using AI
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <label
                htmlFor="audio-upload"
                className={`flex flex-col items-center justify-center min-h-[400px] cursor-pointer transition-all ${
                  uploading
                    ? 'bg-muted/30 cursor-not-allowed'
                    : 'bg-card hover:bg-muted/20'
                }`}
              >
                <div className="flex flex-col items-center justify-center p-12">
                  {uploadSuccess ? (
                    <>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
                      >
                        <CheckCircle2 className="h-20 w-20 text-success mb-6" />
                      </motion.div>
                      <p className="text-xl font-semibold text-foreground mb-2">
                        Upload Complete!
                      </p>
                      <p className="text-muted-foreground">
                        Redirecting to dashboard...
                      </p>
                    </>
                  ) : uploading ? (
                    <>
                      <div className="relative mb-6">
                        <Loader2 className="h-20 w-20 text-primary animate-spin" />
                        <AudioWaveform className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <p className="text-xl font-semibold text-foreground mb-2">
                        Processing Audio...
                      </p>
                      <p className="text-muted-foreground">
                        Transcribing and analyzing your recording
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                        <UploadIcon className="h-12 w-12 text-primary" />
                      </div>
                      <p className="text-xl font-semibold text-foreground mb-2">
                        Drag & drop or click to upload
                      </p>
                      <p className="text-muted-foreground mb-4">
                        your call recording
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {['WebM', 'WAV', 'MP3', 'OGG', 'M4A'].map((format) => (
                          <span
                            key={format}
                            className="px-3 py-1 bg-secondary text-secondary-foreground text-sm rounded-full"
                          >
                            {format}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
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
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Upload;
