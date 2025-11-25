## Syntria

HackUTD Goldman Sachs - Honorable Mention

AI-powered workspace that automates onboarding, detects risk, and supercharges product teams.

Syntria is an all-in-one platform that blends workflow automation, AI risk analysis, and intelligent product tooling. It handles vendor/client onboarding, flags risks in real time, generates product strategy for PMs, and drafts tasks and sprint plans on command — all inside a unified workspace.

## Features
### 1. AI Onboarding and Risk Detection

Step-by-step onboarding wizard

Gemini-powered risk scoring

Auto-routing (Low → auto-approve, Medium → manager review, High → risk committee)

Document, PII, and control checks

Built-in audit trail with CSV export

### 2. Product Management AI Suite

Strategy Agent

Sprint Planner

Task Generator

Idea Evaluator

Research Summaries

Product requirements generation

### 3. Workflow Automation

Auto-generated notes and summaries

Calendar-ready task breakdowns

Automated decommissioning flows

Unified admin panel for backend testing

## Tech Stack
### Frontend

Vite + React

TypeScript

TailwindCSS

ShadCN UI

### Backend

Node.js

Express

Gemini API (risk scoring + PM agents)

ElevenLabs (optional voice agent)

Serverless-style API endpoints

### Dev Tools

GitHub

Vercel (optional deployment)

npm + tsx

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Gemini API key (get one from [Google AI Studio](https://makersuite.google.com/app/apikey))

### 1. Clone the repository

```bash
git clone https://github.com/AryanManda/Syntriav2.git
cd syntria-main
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root directory:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` and add your API keys:

#### Required

```bash
# Gemini API Key (required for AI features)
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey).

#### Optional: Voice Assistant (ElevenLabs)

```bash
# ElevenLabs API Key (for voice assistant features)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

Get your ElevenLabs API key from [ElevenLabs](https://elevenlabs.io/). The voice ID is optional and defaults to Rachel.

#### Optional: Google Calendar Integration

```bash
# Google Calendar OAuth (for calendar sync)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:8787/api/auth/google/callback
```

To set up Google Calendar OAuth:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URI: `http://localhost:8787/api/auth/google/callback`
7. Copy the Client ID and Client Secret to your `.env.local` file

#### Optional: Configuration

```bash
# Frontend URL (defaults to http://localhost:8080)
FRONTEND_URL=http://localhost:8080

# Backend API Port (defaults to 8787)
API_PORT=8787
```

### 4. Run the app

```bash
npm run dev
```

The app will be available at:
- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:8787`

### Environment Variables Summary

**Required:**
- `GEMINI_API_KEY` - Google Gemini API key for AI features

**Optional:**
- `ELEVENLABS_API_KEY` - ElevenLabs API key for voice assistant
- `ELEVENLABS_VOICE_ID` - Voice ID (defaults to Rachel)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID for calendar sync
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - OAuth redirect URI (defaults to localhost)
- `FRONTEND_URL` - Frontend URL (defaults to http://localhost:8080)
- `API_PORT` - Backend API port (defaults to 8787)

## Troubleshooting

### Common Issues

#### 1. "GEMINI_API_KEY is required" Error

Make sure you have created a `.env.local` file in the root directory with your Gemini API key:

```bash
GEMINI_API_KEY=your_actual_api_key_here
```

**Important:** 
- No spaces around the `=` sign
- No quotes around the value
- Restart the server after adding the key

#### 2. TypeScript Errors for Speech Recognition

If you see TypeScript errors about `SpeechRecognition` or `webkitSpeechRecognition`, the types are defined in `src/vite-env.d.ts`. If errors persist:
- Restart your TypeScript server in your IDE
- Make sure you have the latest code from GitHub
- Run `npm install` to ensure all dependencies are installed

#### 3. Google Calendar OAuth Not Working

- Make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env.local`
- Verify the redirect URI matches: `http://localhost:8787/api/auth/google/callback`
- Check that Google Calendar API is enabled in Google Cloud Console
- Make sure your OAuth consent screen is configured
- Add your email as a test user in Google Cloud Console if the app is in testing mode

#### 4. Voice Assistant Not Working

- Make sure `ELEVENLABS_API_KEY` is set in `.env.local`
- Verify the API key starts with `sk-`
- Check that you have credits in your ElevenLabs account
- Voice input requires a browser that supports Web Speech API (Chrome, Edge, Safari)
- Make sure microphone permissions are granted in your browser

#### 5. Port Already in Use

If port 8080 or 8787 is already in use, you can change them in `.env.local`:

```bash
FRONTEND_URL=http://localhost:3000
API_PORT=3001
```

#### 6. Module Not Found Errors

If you get "module not found" errors after cloning:

```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 7. CORS Errors

If you see CORS errors, make sure:
- The backend is running on port 8787
- The frontend is running on port 8080
- `FRONTEND_URL` in `.env.local` matches your frontend URL

## Tech Stack

- **Frontend**: Vite + React + TypeScript, TailwindCSS, shadcn/ui
- **State**: Zustand
- **Charts**: Recharts
- **API**: Express serverless functions
- **AI**: Google Gemini (default) or OpenAI
- **Voice**: ElevenLabs TTS (optional)
- **Integrations**: Google Calendar + Notion (optional, mocked by default)

## API Endpoints

Health check:
```bash
curl http://localhost:8787/api/health
```

Test risk scoring:
```bash
curl -X POST http://localhost:8787/api/risk-score \
  -H "Content-Type: application/json" \
  -d '{
    "controls": {
      "iam": false,
      "encryption": true,
      "logging": true
    },
    "handlesPII": true
  }'
```

## Deployment

### Vercel
1. Connect your repository to Vercel
2. Add environment variables in project settings
3. Deploy (serverless functions auto-detected in `/api/*`)

The development Express server is only for local development. In production, Vercel will handle the API routes as serverless functions.

## Architecture

```
src/
├── components/      # UI components (TopBar, Navigation, Layout)
├── pages/          # Route pages (Overview, Workbench, Admin, etc.)
├── lib/            # Utilities, types, store, API client
└── hooks/          # React hooks

server/
└── index.ts        # Express dev server (proxied by Vite)
```

## License

MIT

---

Built with ❤️ using Lovable
