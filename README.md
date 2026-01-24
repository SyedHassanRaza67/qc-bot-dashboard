# Audio Analyzer AI

AI-powered call quality control dashboard for tracking, managing, and analyzing call center leads.

## Features

- **Call Recording Analysis**: Upload audio files for AI-powered transcription and analysis
- **VICIdial Integration**: Sync call records directly from VICIdial dialer systems
- **Real-time Dashboard**: Monitor call statistics, dispositions, and agent performance
- **AI Transcription**: Automatic transcription using Google Gemini 2.0 Flash
- **Quality Control**: Agent and customer response ratings with detailed analytics

## Technology Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth, Storage)
- **AI**: Google Gemini 2.0 Flash API for audio transcription and analysis

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account (for database and backend)
- Google Gemini API key

### Installation

```bash
# Clone the repository
git clone <your-repo-url>

# Navigate to project directory
cd audio-analyzer-ai

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

The following environment variables are required:

- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/public key
- `GEMINI_API_KEY` - Google Gemini API key (set in Supabase secrets)

## Project Structure

```
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── pages/          # Page components
│   ├── integrations/   # Supabase client and types
│   └── lib/            # Utility functions
├── supabase/
│   ├── functions/      # Edge functions
│   └── migrations/     # Database migrations
└── public/             # Static assets
```

## Edge Functions

- `transcribe-audio` - Manual audio upload transcription
- `transcribe-vicidial` - Single VICIdial record transcription
- `transcribe-background` - Batch background transcription
- `transcribe-pending` - Process pending transcription queue
- `vici-sync` - VICIdial API synchronization
- `get-signed-url` - Generate signed URLs for audio playback
- `proxy-audio` - Audio file proxy for CORS handling

## License

MIT License
