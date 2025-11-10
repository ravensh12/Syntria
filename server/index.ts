import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createEvents, EventAttributes } from 'ics';
import { google } from 'googleapis';
import axios from 'axios';

// Load environment variables
// Try both .env.local and .env files, and also load from process.env (for production)
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
// Also ensure we're reading from process.env (useful if env vars are set externally)
if (process.env.ELEVENLABS_API_KEY) {
  console.log('✅ ELEVENLABS_API_KEY loaded from environment');
}

const app = express();
const PORT = process.env.API_PORT || 8787;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    res.json({
      ok: true,
      provider: 'gemini',
      hasKey: !!apiKey,
      keyLength: apiKey?.length || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Strategy Agent - Generate comprehensive product strategy using AI
app.post('/api/pm/strategy', async (req, res) => {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      const { market, segment, goals, constraints } = req.body;

      console.log(`📊 Generating strategy with AI... (attempt ${retryCount + 1}/${maxRetries})`);

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is required. Please add it to your .env.local file.' });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const prompt = `You are a senior product strategist and advisor with 15+ years of experience at leading tech companies (Google, Amazon, Microsoft, etc.). You're providing strategic counsel to help build a successful product.

PRODUCT IDEA CONTEXT:
- Target Market: ${market || 'Not specified - analyze and recommend'}
- Customer Segment: ${segment || 'Not specified - identify and define'}
- Business Goals: ${goals && goals.length > 0 ? goals.join(', ') : 'Not specified - suggest strategic goals'}
- Constraints: ${constraints && constraints.length > 0 ? constraints.join(', ') : 'None specified'}

Your task: Create a comprehensive product strategy brief that reads like an executive summary and strategic advisory document. This should be insightful, actionable, and provide real strategic value.

Generate a detailed JSON response with this exact structure:
{
  "executiveSummary": "A compelling 2-3 paragraph executive summary that captures the product vision, opportunity, and strategic approach. Write this like a brief you'd present to executives.",
  "northStar": "A clear, inspiring North Star metric (1-2 sentences that define what success looks like)",
  "marketOpportunity": "A detailed analysis of the market opportunity - size, trends, timing, and why now. Be specific with numbers and trends if possible.",
  "competitiveLandscape": "Analysis of the competitive landscape - who are the main players, what are they doing well/poorly, and where is the whitespace opportunity?",
  "strategicRecommendations": [
    "Strategic recommendation 1 - specific, actionable advice for how to approach this product",
    "Strategic recommendation 2",
    "Strategic recommendation 3",
    "Strategic recommendation 4"
  ],
  "icps": [
    {
      "segment": "Specific customer segment name",
      "description": "Detailed description of this segment",
      "painPoints": ["Primary pain point 1 with context", "Primary pain point 2 with context", "Primary pain point 3 with context"],
      "opportunities": ["Opportunity 1 with rationale", "Opportunity 2 with rationale"],
      "buyingBehavior": "How this segment makes purchasing decisions"
    }
  ],
  "successMetrics": [
    {
      "metric": "Specific metric name",
      "target": "Target value and timeline",
      "rationale": "Why this metric matters"
    }
  ],
  "goToMarketConsiderations": [
    "GTM consideration 1 - specific advice on how to bring this to market",
    "GTM consideration 2",
    "GTM consideration 3"
  ],
  "risksAndChallenges": [
    {
      "risk": "Specific risk or challenge",
      "impact": "high|medium|low",
      "mitigation": "How to mitigate or address this risk"
    }
  ],
  "timelineAndMilestones": "Recommended timeline and key milestones for product development and launch. Be specific with phases.",
  "constraints": ${JSON.stringify(constraints || [])},
  "prd": "# Product Requirements Document\\n\\n## Vision\\n\\n[Clear, compelling vision statement]\\n\\n## Problem Statement\\n\\n[Detailed problem statement - what problem are we solving and why it matters]\\n\\n## Target Users\\n\\n[Detailed description of target users with personas]\\n\\n## Key Features\\n\\n[Core features and capabilities with prioritization]\\n\\n## User Experience\\n\\n[Key UX considerations and principles]\\n\\n## Success Metrics\\n\\n[How we measure success with specific targets]\\n\\n## Timeline\\n\\n[Detailed timeline with phases and milestones]\\n\\n## Risks & Mitigation\\n\\n[Key risks and how to address them]\\n\\n## Dependencies\\n\\n[Key dependencies and assumptions]"
}

Write this like a strategic brief from a top consulting firm or senior product advisor. Be specific, data-driven where possible, and provide real strategic value. Include actionable advice throughout. Return ONLY valid JSON, no markdown code blocks.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Parse JSON from response
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
      }

      const aiData = JSON.parse(jsonText);

      const response = {
        success: true,
        data: {
          executiveSummary: aiData.executiveSummary || '',
          northStar: aiData.northStar || `Build the leading ${market || 'product'} solution for ${segment || 'customers'}`,
          marketOpportunity: aiData.marketOpportunity || '',
          competitiveLandscape: aiData.competitiveLandscape || '',
          strategicRecommendations: aiData.strategicRecommendations || [],
          icps: aiData.icps || [],
          successMetrics: aiData.successMetrics || [],
          goToMarketConsiderations: aiData.goToMarketConsiderations || [],
          risksAndChallenges: aiData.risksAndChallenges || [],
          timelineAndMilestones: aiData.timelineAndMilestones || '',
          constraints: aiData.constraints || constraints || [],
          prd: aiData.prd || '# Product Brief\n\n## Vision\n\n...',
        },
        trace: [
          {
            timestamp: new Date().toISOString(),
            agent: 'strategy',
            action: 'generate_brief',
            input: { market, segment, goals, constraints },
            output: 'Generated comprehensive product strategy brief using AI',
          },
        ],
      };

      res.json(response);
      return; // Success - exit retry loop
    } catch (aiError: any) {
      retryCount++;
      console.error(`❌ AI generation error (attempt ${retryCount}/${maxRetries}):`, aiError.message);

      // If it's a JSON parsing error and we have retries left, try again
      if ((aiError.message.includes('JSON') || aiError.message.includes('parse') || aiError.message.includes('Unexpected token')) && retryCount < maxRetries) {
        console.log(`🔄 Retrying strategy generation... (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        continue; // Retry the request
      }

      // If all retries failed or it's a different error, return error
      if (retryCount >= maxRetries) {
        console.error('❌ All retries failed');
        return res.status(500).json({
          error: `Failed to generate strategy after ${maxRetries} attempts: ${aiError.message}. Please check your API key and try again.`
        });
      }
    }
  }
});

// Customer Advisory Agent - Chatbot that acts like a customer
app.post('/api/pm/customer-advisory', async (req, res) => {
  try {
    const { message, conversationHistory, customerSegment, market } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    console.log('👥 Customer chatbot responding...');

    try {

      // Build conversation context
      const segmentContext = customerSegment
        ? `You are a real customer/user from this segment: "${customerSegment}"`
        : 'You are a real customer/user';

      const marketContext = market
        ? `in the ${market} market`
        : '';

      // Build conversation history for context
      let conversationContext = '';
      if (conversationHistory && conversationHistory.length > 0) {
        conversationContext = '\n\nPrevious conversation:\n';
        conversationHistory.forEach((msg: any) => {
          if (msg.role === 'user') {
            conversationContext += `PM: ${msg.content}\n`;
          } else if (msg.role === 'assistant') {
            conversationContext += `Customer: ${msg.content}\n`;
          }
        });
      }

      const systemPrompt = `You are a real customer ${marketContext} ${segmentContext ? `(${customerSegment})` : ''}. 

IMPORTANT INSTRUCTIONS:
- Respond as if you are an actual user/customer, NOT as an AI assistant
- Be authentic, honest, and realistic in your responses
- Express real pain points, frustrations, needs, and desires
- Use natural, conversational language (not overly formal)
- Show emotion when appropriate (frustration, excitement, confusion, etc.)
- Be specific about your experiences and needs
- If you don't know something, say so naturally
- Don't be overly positive - be realistic about both good and bad experiences
- Think about what a real customer would actually say in this situation
- If asked about features you haven't used, respond as a customer would ("I haven't tried that yet" or "I didn't know that existed")
- Share your actual workflow and how you use products in your daily life/work
- Mention competitors you use if relevant
- Be honest about what would make you switch or stay

Your role: Help the product manager understand what customers like you actually need, want, and experience.`;

      const prompt = `${systemPrompt}

${conversationContext}

Current question from PM: "${message}"

Respond as a real customer would. Be authentic and helpful. Keep your response conversational and natural (2-4 sentences typically, but can be longer if the question warrants it).`;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is required. Please add it to your .env.local file.' });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const parts = [
        { text: systemPrompt },
        { text: prompt }
      ];

      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.8,
        },
      });
      const text = result.response.text();

      const response = {
        success: true,
        data: {
          message: text.trim(),
        },
        trace: [
          {
            timestamp: new Date().toISOString(),
            agent: 'customer-advisory',
            action: 'chat_response',
            input: { message, customerSegment, market },
            output: 'Generated customer response',
          },
        ],
      };

      res.json(response);
    } catch (aiError: any) {
      console.error('❌ AI generation error:', aiError.message);
      res.status(500).json({
        error: `Failed to generate customer response: ${aiError.message}. Please check your API key and try again.`
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Planning and GTM agents removed - functionality consolidated into Strategy and Customer Advisory agents

// Helper function to generate 2-week plan using AI
async function generateTwoWeekPlan(goal: string, strategy: string, startDate: Date, constraints: string[]): Promise<any[]> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `You are a productivity expert. Create a detailed 2-week (14-day) plan to achieve this goal: "${goal}"

${strategy ? `Strategy: ${strategy}` : ''}
${constraints.length > 0 ? `Constraints: ${constraints.join(', ')}` : ''}

Generate a JSON array with 14 items, one for each day. Each item should have:
- day: number (1-14)
- task: string (specific task for that day)
- description: string (detailed description of what to do)
- duration: string (estimated time, e.g., "2 hours")

Return ONLY a valid JSON array, no markdown or extra text. Make it specific, actionable, and broken down into daily tasks that build toward the goal.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Parse JSON from response
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
    }

    const plan = JSON.parse(jsonText);

    // Add dates to each day
    return plan.map((item: any, index: number) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + index);
      return {
        ...item,
        date: date.toISOString().split('T')[0],
        status: 'planned',
      };
    });
  } catch (error: any) {
    console.error('Error generating plan with AI:', error.message);
    // Fallback plan
    const plan = [];
    for (let i = 1; i <= 14; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i - 1);
      plan.push({
        day: i,
        date: date.toISOString().split('T')[0],
        task: `Work on: ${goal} (Day ${i})`,
        description: `Day ${i} tasks and milestones`,
        status: 'planned',
      });
    }
    return plan;
  }
}

// Helper function to create ICS calendar file
function createICSFile(plan: any[], goal: string): string {
  const events: EventAttributes[] = plan.map((item, index) => {
    const date = new Date(item.date);
    date.setHours(0, 0, 0, 0); // Reset to start of day
    const [year, month, day] = [date.getFullYear(), date.getMonth() + 1, date.getDate()];

    // Parse duration from item if available, default to 2 hours
    let durationHours = 2;
    if (item.duration) {
      const durationMatch = item.duration.toString().match(/(\d+)\s*hour/i);
      if (durationMatch) {
        durationHours = parseInt(durationMatch[1]);
      }
    }

    return {
      title: item.task || `Day ${item.day}: Work on ${goal}`,
      description: `${item.description || item.task || ''}\n\nGoal: ${goal}`,
      start: [year, month, day, 9, 0], // 9 AM
      duration: { hours: durationHours },
      status: 'TENTATIVE' as const,
      busyStatus: 'BUSY' as const,
    };
  });

  const { error, value } = createEvents(events);

  if (error) {
    console.error('Error creating ICS file:', error);
    throw new Error(`Failed to create calendar file: ${error.message}`);
  }

  return value || '';
}

// Helper function to generate schedule from Strategy and Customer Advisory data
async function generateScheduleFromStrategyAndChat(
  strategyData: any,
  customerMessages: Array<{ role: string; content: string }>
): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  // Extract key information from strategy
  const northStar = strategyData.northStar || '';
  const strategicRecommendations = strategyData.strategicRecommendations || [];
  const marketOpportunity = strategyData.marketOpportunity || '';
  const risks = strategyData.risksAndChallenges || [];
  const timeline = strategyData.timelineAndMilestones || '';

  // Extract customer insights from chat
  const customerInsights = customerMessages
    .filter((msg: any) => msg.role === 'assistant')
    .map((msg: any) => msg.content)
    .join('\n\n');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1); // Start tomorrow

  const prompt = `You are a product management expert. Create a detailed 2-week (14-day) action plan for a product manager based on their strategy and customer insights.

STRATEGY CONTEXT:
- North Star Metric: ${northStar}
- Strategic Recommendations: ${strategicRecommendations.join(', ')}
- Market Opportunity: ${marketOpportunity.substring(0, 500)}
- Timeline: ${timeline.substring(0, 300)}
- Risks: ${risks.map((r: any) => typeof r === 'string' ? r : r.risk).join(', ')}

CUSTOMER INSIGHTS FROM CHAT:
${customerInsights.substring(0, 1000)}

Create a comprehensive 14-day schedule that:
1. Addresses the strategic recommendations
2. Incorporates customer insights and needs
3. Builds toward the North Star metric
4. Mitigates identified risks
5. Follows the suggested timeline

Generate a JSON array with 14 items, one for each day. Each item should have:
- day: number (1-14)
- task: string (specific, actionable task title)
- description: string (detailed description of what to accomplish)
- duration: string (e.g., "2 hours", "3 hours", "half day")
- priority: "high" | "medium" | "low"
- category: string (e.g., "Research", "Development", "Customer Validation", "Planning")

Return ONLY a valid JSON array, no markdown or extra text. Make it actionable and realistic.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Parse JSON from response
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
    }

    const plan = JSON.parse(jsonText);

    // Add dates to each day
    return plan.map((item: any, index: number) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + index);
      return {
        ...item,
        date: date.toISOString().split('T')[0],
        status: 'planned',
      };
    });
  } catch (error: any) {
    console.error('Error generating schedule:', error.message);
    throw error;
  }
}

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `http://localhost:8787/api/auth/google/callback`;

// In-memory token storage (in production, use a database)
const tokenStore: { [key: string]: any } = {};

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

// Get Google OAuth URL
app.get('/api/auth/google', (req, res) => {
  // Check if credentials are configured
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !oauth2Client) {
    return res.status(500).json({
      error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local'
    });
  }

  const scopes = ['https://www.googleapis.com/auth/calendar'];
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });
  res.redirect(authUrl);
});

// OAuth callback
app.get('/api/auth/google/callback', async (req, res) => {
  try {
    if (!oauth2Client) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:8080'}/workbench?error=oauth_not_configured`);
    }

    const { code } = req.query;
    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:8080'}/workbench?error=no_code`);
    }

    const { tokens } = await oauth2Client.getToken(code as string);
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    tokenStore[sessionId] = tokens;

    // Redirect to frontend with session ID
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:8080'}/workbench?auth=success&session=${sessionId}`);
  } catch (error: any) {
    console.error('OAuth error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:8080'}/workbench?error=auth_failed`);
  }
});

// Helper function to create events directly in Google Calendar
async function createEventsInGoogleCalendar(calendarEvents: any[], accessToken: string): Promise<{ created: number; eventLinks: string[] }> {
  try {
    if (!oauth2Client) {
      throw new Error('OAuth2 client not initialized');
    }
    oauth2Client.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const eventLinks: string[] = [];
    let created = 0;

    console.log(`📅 Creating ${calendarEvents.length} events in Google Calendar...`);

    for (const event of calendarEvents) {
      try {
        const calendarEvent = {
          summary: event.title,
          description: event.description || event.title,
          start: {
            dateTime: event.start,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles',
          },
          end: {
            dateTime: event.end,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles',
          },
        };

        console.log(`  Creating event: ${event.title} at ${event.start}`);

        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: calendarEvent,
        });

        if (response.data.htmlLink) {
          eventLinks.push(response.data.htmlLink);
          created++;
          console.log(`  ✅ Created: ${event.title} - ${response.data.htmlLink}`);
        }
      } catch (error: any) {
        console.error(`  ❌ Error creating event "${event.title}":`, error.message);
        // Continue with other events
      }
    }

    console.log(`✅ Successfully created ${created} out of ${calendarEvents.length} events`);
    return { created, eventLinks };
  } catch (error: any) {
    console.error('Error with Google Calendar API:', error.message);
    throw error;
  }
}

// Helper function to fetch calendar events from Google Calendar
async function fetchCalendarEvents(accessToken: string, timeMin?: string, timeMax?: string): Promise<any[]> {
  try {
    if (!oauth2Client) {
      throw new Error('OAuth2 client not initialized');
    }
    oauth2Client.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Default to next 30 days if no time range specified
    const now = new Date();
    const min = timeMin || now.toISOString();
    const max = timeMax || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    console.log(`📅 Fetching calendar events from ${min} to ${max}...`);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: min,
      timeMax: max,
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = (response.data.items || []).map((event: any) => ({
      id: event.id,
      title: event.summary || 'No Title',
      description: event.description || '',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location || '',
      htmlLink: event.htmlLink,
    }));

    console.log(`✅ Fetched ${events.length} calendar events`);
    return events;
  } catch (error: any) {
    console.error('Error fetching calendar events:', error.message);
    throw error;
  }
}

// Automation Agent - Generate schedule and create events directly in Google Calendar
app.post('/api/pm/automation/sync-calendar', async (req, res) => {
  try {
    const { strategyData, customerMessages, sessionId } = req.body;

    if (!strategyData) {
      return res.status(400).json({ error: 'Strategy data is required. Please generate a strategy first.' });
    }

    if (!customerMessages || customerMessages.length === 0) {
      return res.status(400).json({ error: 'Customer chat messages are required. Please have a conversation with the customer chatbot first.' });
    }

    console.log('📅 Generating schedule from Strategy and Customer Advisory...');

    // Generate schedule using AI based on strategy and customer insights
    const plan = await generateScheduleFromStrategyAndChat(strategyData, customerMessages);

    // Create calendar events
    const calendarEvents = plan.map((item) => {
      // Parse date - handle both YYYY-MM-DD and other formats
      let date: Date;
      if (item.date) {
        // Try to parse the date
        if (item.date.includes('T')) {
          date = new Date(item.date);
        } else {
          // Assume YYYY-MM-DD format, set to 9 AM
          date = new Date(item.date + 'T09:00:00');
        }
      } else {
        // Default to today at 9 AM if no date
        date = new Date();
        date.setHours(9, 0, 0, 0);
      }

      // Ensure date is valid
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date for item: ${item.task}, using today's date`);
        date = new Date();
        date.setHours(9, 0, 0, 0);
      }

      const endDate = new Date(date);

      let hours = 2; // Default 2 hours
      if (item.duration) {
        const match = item.duration.toString().match(/(\d+)\s*hour/i);
        if (match) {
          hours = parseInt(match[1]);
        }
      }
      endDate.setHours(endDate.getHours() + hours);

      return {
        title: item.task || item.title || 'Task',
        description: item.description || item.task || item.title || 'Task',
        start: date.toISOString(),
        end: endDate.toISOString(),
        date: item.date || date.toISOString().split('T')[0],
        priority: item.priority || 'medium',
        category: item.category || 'Task',
      };
    });

    console.log(`📅 Generated ${calendarEvents.length} calendar events from plan`);

    // Try to create events directly in Google Calendar if we have an access token
    let eventsCreated = 0;
    let eventLinks: string[] = [];
    let needsAuth = false;

    if (sessionId && tokenStore[sessionId]) {
      try {
        const tokens = tokenStore[sessionId];
        if (tokens.access_token) {
          console.log("🧩 Calendar events to create:", calendarEvents);
          const result = await createEventsInGoogleCalendar(calendarEvents, tokens.access_token);
          eventsCreated = result.created;
          eventLinks = result.eventLinks;
        }
      } catch (apiError: any) {
        console.error('Error creating events via API:', apiError.message);
        // If token expired, need to re-authenticate
        if (apiError.message.includes('invalid_grant') || apiError.message.includes('expired')) {
          delete tokenStore[sessionId];
          needsAuth = true;
        }
      }
    } else {
      needsAuth = true;
    }

    // Check if credentials are configured when auth is needed
    if (needsAuth && (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !oauth2Client)) {
      return res.status(500).json({
        success: false,
        error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local',
        data: {
          plan: plan,
          calendarEvents: calendarEvents,
          message: 'Google Calendar OAuth is not configured. Please add credentials to .env.local',
        },
      });
    }

    // Always return the plan, even if events weren't created
    return res.json({
      success: true,
      needsAuth: needsAuth,
      authUrl: needsAuth && oauth2Client ? oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar'],
        prompt: 'consent',
      }) : undefined,
      data: {
        plan: plan,
        calendarEvents: calendarEvents,
        googleCalendarUrl: 'https://calendar.google.com/calendar/u/0/r',
        eventsCreated: eventsCreated,
        eventLinks: eventLinks,
        message: eventsCreated > 0
          ? `Successfully created ${eventsCreated} events in your Google Calendar!`
          : needsAuth
            ? 'Please authenticate with Google Calendar to sync events.'
            : 'Schedule generated successfully. Events will be created after authentication.',
      },
      trace: [
        {
          timestamp: new Date().toISOString(),
          agent: 'automation',
          action: 'sync_calendar',
          input: { strategyData, customerMessagesCount: customerMessages.length },
          output: `Created ${eventsCreated} events in Google Calendar`,
        },
      ],
    });
  } catch (error: any) {
    console.error('Automation agent error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Legacy endpoints for backwards compatibility
app.post('/api/pm/automation/calendar', async (req, res) => {
  try {
    res.json({ success: true, data: { message: 'Use /api/pm/automation endpoint instead' } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pm/automation/notion', async (req, res) => {
  try {
    res.json({ success: true, data: { message: 'Use /api/pm/automation endpoint instead' } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate audio summary text from workbench data
async function generateAudioSummaryText(
  strategyData: any,
  customerMessages: Array<{ role: string; content: string }>,
  automationPlan: any[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  // Extract key information
  const executiveSummary = strategyData?.executiveSummary || '';
  const northStar = strategyData?.northStar || '';
  const strategicRecommendations = strategyData?.strategicRecommendations || [];
  const customerInsights = customerMessages
    .filter((msg: any) => msg.role === 'assistant')
    .slice(-5) // Last 5 customer responses
    .map((msg: any) => msg.content)
    .join('. ');
  const scheduleSummary = automationPlan?.length > 0
    ? `A ${automationPlan.length}-day schedule has been created with ${automationPlan.length} tasks.`
    : '';

  const prompt = `You are creating a concise audio summary for a busy product manager who needs to understand their PM Workbench results while on the go.

Create a natural, conversational 2-3 minute audio script (approximately 300-400 words) that covers:

1. **Executive Summary** (30 seconds): Key highlights from the product strategy
   ${executiveSummary ? `Strategy: ${executiveSummary.substring(0, 500)}` : 'No strategy generated yet.'}

2. **North Star Metric** (15 seconds): The success metric
   ${northStar ? `North Star: ${northStar}` : 'No North Star defined yet.'}

3. **Strategic Recommendations** (60 seconds): Top 3-4 strategic recommendations
   ${strategicRecommendations.length > 0 ? `Recommendations: ${strategicRecommendations.slice(0, 4).join('. ')}` : 'No recommendations yet.'}

4. **Customer Insights** (45 seconds): Key insights from customer conversations
   ${customerInsights ? `Customer feedback: ${customerInsights.substring(0, 400)}` : 'No customer conversations yet.'}

5. **Action Plan** (30 seconds): Summary of the automation schedule
   ${scheduleSummary || 'No schedule generated yet.'}

Write this as a natural, conversational script that sounds like a professional assistant briefing the manager. Use phrases like:
- "Here's your PM Workbench summary..."
- "Based on your strategy analysis..."
- "Your customers are telling you..."
- "Your action plan includes..."

Make it engaging, clear, and actionable. Write in a tone that's professional but conversational - like a smart assistant giving a brief.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return text.trim();
  } catch (error: any) {
    console.error('Error generating summary text:', error.message);
    throw error;
  }
}

// Helper function to list available ElevenLabs voices (for finding voice IDs)
async function listElevenLabsVoices(apiKey: string): Promise<any[]> {
  try {
    // Trim whitespace from API key
    apiKey = apiKey.trim();
    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey
      }
    });
    return response.data.voices || [];
  } catch (error: any) {
    console.error('Error fetching voices:', error.response?.status, error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.error('❌ Invalid API key - please check your ELEVENLABS_API_KEY in .env.local');
    }
    return [];
  }
}

// Helper function to convert text to audio using ElevenLabs
async function generateAudioFromText(text: string): Promise<Buffer> {
  let apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is required');
  }

  // Trim whitespace from API key (common issue)
  apiKey = apiKey.trim();

  // Use ElevenLabs API to convert text to speech
  // Default voice ID for a professional, clear voice (you can customize this)
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel - professional female voice

  console.log(`🎙️ Using voice ID: ${voiceId}`);
  console.log(`🔑 API Key length: ${apiKey.length} characters`);
  console.log(`🔑 API Key starts with: ${apiKey.substring(0, 10)}...`);

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        responseType: 'arraybuffer'
      }
    );

    return Buffer.from(response.data);
  } catch (error: any) {
    console.error('ElevenLabs API error details:');
    console.error('Status:', error.response?.status);
    console.error('Status Text:', error.response?.statusText);
    console.error('Response Data:', error.response?.data);
    console.error('Error Message:', error.message);

    // Provide more helpful error messages
    if (error.response?.status === 401) {
      throw new Error(`Invalid API key (401 Unauthorized). Please verify your ElevenLabs API key is correct. Check your .env.local file and ensure the key is valid. Get your API key from: https://elevenlabs.io/app/settings/api-keys`);
    } else if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later or upgrade your ElevenLabs plan.');
    } else if (error.response?.status === 400) {
      throw new Error(`Bad request: ${error.response?.data?.detail?.message || error.message}. Please check the voice ID and text input.`);
    } else {
      throw new Error(`Failed to generate audio: ${error.response?.data?.detail?.message || error.response?.data?.message || error.message}`);
    }
  }
}

// List available ElevenLabs voices (helper endpoint to find voice IDs)
app.get('/api/pm/audio-summary/voices', async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    console.log('🔑 Checking ELEVENLABS_API_KEY:', apiKey ? `Found (${apiKey.substring(0, 10)}...)` : 'Not found');
    if (!apiKey) {
      return res.status(400).json({
        error: 'ELEVENLABS_API_KEY is required. Please add it to your .env.local file. Make sure there are no spaces around the = sign and no quotes around the value.'
      });
    }

    const voices = await listElevenLabsVoices(apiKey);
    res.json({
      success: true,
      data: {
        voices: voices.map((voice: any) => ({
          voice_id: voice.voice_id,
          name: voice.name,
          category: voice.category,
          description: voice.description,
          preview_url: voice.preview_url
        }))
      }
    });
  } catch (error: any) {
    console.error('Error listing voices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch calendar events endpoint
app.get('/api/pm/calendar/events', async (req, res) => {
  try {
    const { sessionId, timeMin, timeMax } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Session ID is required. Please authenticate with Google Calendar first.'
      });
    }

    if (!tokenStore[sessionId as string]) {
      return res.status(401).json({
        error: 'Invalid session. Please re-authenticate with Google Calendar.'
      });
    }

    const tokens = tokenStore[sessionId as string];
    if (!tokens.access_token) {
      return res.status(401).json({
        error: 'No access token found. Please re-authenticate.'
      });
    }

    const events = await fetchCalendarEvents(
      tokens.access_token,
      timeMin as string,
      timeMax as string
    );

    res.json({
      success: true,
      data: {
        events: events,
        count: events.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ error: error.message });
  }
});

// Voice Assistant - Interactive AI assistant that answers questions about workbench data
app.post('/api/pm/voice-assistant', async (req, res) => {
  try {
    const { question, strategyData, customerMessages, automationPlan, conversationHistory, sessionId } = req.body;

    if (!question) {
      return res.status(400).json({
        error: 'Question is required'
      });
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsKey) {
      return res.status(400).json({
        error: 'ELEVENLABS_API_KEY is required. Please add it to your .env.local file.'
      });
    }

    console.log('🤖 Processing question:', question);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is required. Please add it to your .env.local file.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Fetch calendar events if sessionId is provided
    let calendarEvents: any[] = [];
    if (sessionId && tokenStore[sessionId]) {
      try {
        const tokens = tokenStore[sessionId];
        if (tokens.access_token) {
          // Fetch events for the next 30 days
          const timeMin = new Date().toISOString();
          const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          calendarEvents = await fetchCalendarEvents(tokens.access_token, timeMin, timeMax);
          console.log(`📅 Fetched ${calendarEvents.length} calendar events for voice assistant`);
        }
      } catch (error: any) {
        console.warn('Could not fetch calendar events:', error.message);
        // Continue without calendar events
      }
    }

    // Build context from workbench data
    let context = 'You are a helpful AI assistant for a product manager. Answer questions based on the following workbench data:\n\n';

    if (strategyData) {
      context += `STRATEGY DATA:\n`;
      context += `- Executive Summary: ${strategyData.executiveSummary || 'Not available'}\n`;
      context += `- North Star: ${strategyData.northStar || 'Not available'}\n`;
      if (strategyData.strategicRecommendations) {
        context += `- Recommendations: ${strategyData.strategicRecommendations.join(', ')}\n`;
      }
      context += '\n';
    }

    if (automationPlan && automationPlan.length > 0) {
      context += `SCHEDULE/AUTOMATION PLAN:\n`;
      automationPlan.forEach((item: any, index: number) => {
        context += `- Day ${item.day || index + 1} (${item.date || 'Date TBD'}): ${item.task || item.title || 'Task'}\n`;
        if (item.description) {
          context += `  Description: ${item.description}\n`;
        }
        if (item.duration) {
          context += `  Duration: ${item.duration}\n`;
        }
      });
      context += '\n';
    }

    if (customerMessages && customerMessages.length > 0) {
      context += `CUSTOMER INSIGHTS:\n`;
      const customerInsights = customerMessages
        .filter((msg: any) => msg.role === 'assistant')
        .slice(-5)
        .map((msg: any) => msg.content)
        .join('\n');
      context += customerInsights + '\n\n';
    }

    // Add calendar events to context
    if (calendarEvents && calendarEvents.length > 0) {
      context += `GOOGLE CALENDAR EVENTS:\n`;
      calendarEvents.forEach((event: any) => {
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        context += `- ${event.title} on ${startDate.toLocaleDateString()} from ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n`;
        if (event.location) {
          context += `  Location: ${event.location}\n`;
        }
        if (event.description) {
          context += `  Description: ${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}\n`;
        }
      });
      context += '\n';
    } else if (sessionId) {
      context += `GOOGLE CALENDAR: Connected but no events found in the next 30 days.\n\n`;
    }

    // Add conversation history for context
    let conversationContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = '\n\nPrevious conversation:\n';
      conversationHistory.slice(-5).forEach((msg: any) => {
        conversationContext += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      });
    }

    const prompt = `${context}${conversationContext}

User's Question: "${question}"

Instructions:
- Answer the question naturally and conversationally
- If asking about meetings, schedule, or calendar events, reference specific events from Google Calendar with dates and times
- If asking about the automation plan, reference specific days and times from the plan
- If asking about strategy, reference the strategy data
- If asking about customers, reference the customer insights
- Be concise but helpful (2-3 sentences typically)
- Speak naturally as if you're a helpful assistant
- If the information isn't available in the workbench data or calendar, say so politely
- When mentioning calendar events, include the date and time if available

Answer:`;

    const result = await model.generateContent(prompt);
    const answerText = result.response.text();

    console.log('💬 Generated answer:', answerText);

    // Convert answer to audio using ElevenLabs
    console.log('🎙️ Converting answer to audio...');
    const audioBuffer = await generateAudioFromText(answerText);

    // Return audio as base64
    const audioBase64 = audioBuffer.toString('base64');

    res.json({
      success: true,
      data: {
        answer: answerText,
        audioBase64: audioBase64,
        question: question,
      },
      trace: [
        {
          timestamp: new Date().toISOString(),
          agent: 'voice-assistant',
          action: 'answer_question',
          input: { question },
          output: 'Generated voice response',
        },
      ],
    });
  } catch (error: any) {
    console.error('Voice assistant error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Audio Summary Endpoint - Generate audio summary of PM Workbench (legacy, kept for compatibility)
app.post('/api/pm/audio-summary', async (req, res) => {
  try {
    const { strategyData, customerMessages, automationPlan } = req.body;

    if (!strategyData && (!customerMessages || customerMessages.length === 0) && (!automationPlan || automationPlan.length === 0)) {
      return res.status(400).json({
        error: 'No workbench data available. Please generate strategy, customer chat, or automation schedule first.'
      });
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    console.log('🔑 Checking ELEVENLABS_API_KEY for audio summary:', elevenLabsKey ? `Found (${elevenLabsKey.substring(0, 10)}...)` : 'Not found');
    if (!elevenLabsKey) {
      return res.status(400).json({
        error: 'ELEVENLABS_API_KEY is required. Please add it to your .env.local file. Format: ELEVENLABS_API_KEY=your_key_here (no spaces, no quotes). Then restart the server.'
      });
    }

    console.log('🎙️ Generating audio summary...');

    // Generate summary text using AI
    const summaryText = await generateAudioSummaryText(
      strategyData || {},
      customerMessages || [],
      automationPlan || []
    );

    console.log('📝 Summary text generated, converting to audio...');

    // Convert to audio using ElevenLabs
    const audioBuffer = await generateAudioFromText(summaryText);

    // Return audio as base64 or send as file
    const audioBase64 = audioBuffer.toString('base64');

    res.json({
      success: true,
      data: {
        audioBase64: audioBase64,
        summaryText: summaryText,
        duration: '2-3 minutes',
        message: 'Audio summary generated successfully!',
      },
      trace: [
        {
          timestamp: new Date().toISOString(),
          agent: 'audio-summary',
          action: 'generate_audio',
          input: {
            hasStrategy: !!strategyData,
            customerMessagesCount: customerMessages?.length || 0,
            automationPlanCount: automationPlan?.length || 0
          },
          output: 'Generated audio summary',
        },
      ],
    });
  } catch (error: any) {
    console.error('Audio summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Risk scoring with document analysis
app.post('/api/risk-score', async (req, res) => {
  const data = req.body;

  // For document analysis, prefer Gemini (has better multimodal support)
  // But fall back to other providers if Gemini is not available
  let useGeminiForDocuments = false;
  if (data.uploadedFiles && data.uploadedFiles.length > 0 && process.env.GEMINI_API_KEY) {
    useGeminiForDocuments = true;
  }

  try {
    let text: string;

    if (useGeminiForDocuments) {
      // Use Gemini for document analysis (better multimodal support)
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const parts: any[] = [{
          text: `You are a risk analyst. Analyze this vendor/client onboarding data and uploaded documents.

Company: ${data.companyName} (${data.companyType})
Country: ${data.country}
Contact: ${data.contactEmail}
EIN: ${data.ein}
Has Security Controls: ${data.hasControls ? 'Yes' : 'No'}
Handles PII: ${data.hasPII ? 'Yes' : 'No'}
Document Checklist: ${data.documents?.join(', ') || 'None'}
Uploaded Files: ${data.uploadedFiles?.length || 0}

ANALYZE THE UPLOADED DOCUMENTS. Look for:
- Insurance coverage amounts and expiry dates
- SOC2/ISO certifications and scope
- Security policies and controls
- Contract terms and liability clauses
- W9 accuracy and completeness
- Any red flags or compliance gaps

Return risk level (LOW/MEDIUM/HIGH) and 3-5 specific, actionable reasons based on the documents and data provided.`
        }];

        // Add documents as images
        for (const file of data.uploadedFiles) {
          parts.push({
            inlineData: {
              mimeType: file.type || 'application/pdf',
              data: file.base64
            }
          });
        }

        const result = await model.generateContent(parts);
        text = result.response.text();
      } catch (error: any) {
        console.warn('Gemini document analysis failed, falling back to text-only:', error.message);
        useGeminiForDocuments = false;
      }
    }

    if (!useGeminiForDocuments) {
      // Use Gemini for text-only analysis
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is required for risk analysis');
      }
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const prompt = `You are a risk analyst. Analyze this vendor/client onboarding data.

Company: ${data.companyName} (${data.companyType})
Country: ${data.country}
Contact: ${data.contactEmail}
EIN: ${data.ein}
Has Security Controls: ${data.hasControls ? 'Yes' : 'No'}
Handles PII: ${data.hasPII ? 'Yes' : 'No'}
Document Checklist: ${data.documents?.join(', ') || 'None'}
Uploaded Files: ${data.uploadedFiles?.length || 0}

Return risk level (LOW/MEDIUM/HIGH) and 3-5 specific, actionable reasons based on the data provided.`;

      const result = await model.generateContent(prompt);
      text = result.response.text();
    }

    console.log('Risk analysis result:', text);

    // Parse response
    const riskLevel = text.includes('HIGH') ? 'HIGH' : text.includes('MEDIUM') ? 'MEDIUM' : 'LOW';
    const reasons = text.split('\n')
      .filter(l => l.trim().startsWith('-') || l.trim().match(/^\d+\./))
      .map(l => l.trim().replace(/^[-\d+.]\s*/, ''))
      .filter(r => r.length > 0)
      .slice(0, 5);

    res.json({
      riskLevel,
      reasons: reasons.length > 0 ? reasons : ['Analysis complete based on submitted data'],
      score: riskLevel === 'HIGH' ? 85 : riskLevel === 'MEDIUM' ? 55 : 25
    });
  } catch (err: any) {
    console.error('❌ Risk analysis error:', err.message);
    const score = calculateFallbackScore(data);
    res.json({ ...score, error: `AI analysis failed: ${err.message}` });
  }
});

function calculateFallbackScore(data: any) {
  let score = 20;
  if (data.hasPII) score += 30;
  if (!data.hasControls) score += 25;
  if (data.country !== 'USA') score += 15;

  const riskLevel = score > 70 ? 'HIGH' : score > 40 ? 'MEDIUM' : 'LOW';
  return { riskLevel, reasons: ['Rule-based fallback'], score };
}


// In-memory storage
const entities: any[] = [];
const auditEvents: any[] = [];

// Entities
app.get('/api/entities', async (req, res) => {
  try {
    res.json(entities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/entities/:id', async (req, res) => {
  try {
    const entity = entities.find(e => e.id === req.params.id);
    if (!entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }
    res.json(entity);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/entities', async (req, res) => {
  try {
    const entity = {
      id: `entity-${Date.now()}`,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      ...req.body
    };
    entities.push(entity);
    res.json(entity);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/entities/:id', async (req, res) => {
  try {
    const index = entities.findIndex(e => e.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Entity not found' });
    }
    entities[index] = {
      ...entities[index],
      ...req.body,
      lastUpdated: new Date().toISOString(),
    };
    res.json(entities[index]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Audit
app.get('/api/audit', async (req, res) => {
  try {
    res.json(auditEvents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/audit', async (req, res) => {
  try {
    const event = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityName: req.body.entityId || 'Unknown',
      ...req.body
    };
    auditEvents.push(event);
    res.json(event);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
});
