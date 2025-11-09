## Syntria

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
### 1. Clone the repository
git clone https://github.com/bforce541/syntria
cd syntria

### 2. Install dependencies
npm install

### 3. Add your environment variables

Create a file named .env.local:

GEMINI_API_KEY=your_key_here
ELEVENLABS_API_KEY=optional_voice_key

### 4. Run the app
npm run dev


Local development:
http://localhost:8080

## Project Structure
/src
  /pages
  /components
  /lib
/server
/api
README.md
.env.local   (ignored)

## What Syntria Does

Syntria unifies two major problem spaces:

### A) Secure Onboarding

Automates KYC/KYB-style onboarding with AI risk analysis.

### B) Product Intelligence

Turns product managers into a 10x force through automated strategy, task creation, sprint planning, and research insights.

## What We Learned

How to combine multiple agents into a single workflow

How to integrate Gemini AI into serverless endpoints

How to design systems that scale cleanly under time pressure

How to debug merge conflicts, environment issues, and API failures

## What's Next for Syntria

Full database integration

Vendor graph visualization

Multi-agent coordination

Role-based access controls

Voice-driven PM workflows

Enterprise-grade onboarding modules


## Syntria — Automate everything. Accelerate everyone.
