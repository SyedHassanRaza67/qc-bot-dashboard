import { AudioWaveform } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-card border-t border-border py-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AudioWaveform className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">AI Audio Analyzer</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2025 AI Audio Analyzer — All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
