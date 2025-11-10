import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Target, MessageSquare, Zap, Download, Star, Users, CheckCircle, AlertCircle, Lightbulb, Quote, Volume2, Play, Pause } from "lucide-react";
import { runStrategyAgent, runCustomerAdvisoryAgent, syncCalendar, generateAudioSummary, listElevenLabsVoices, askVoiceAssistant } from "@/lib/api";

// Simple markdown to HTML converter
const markdownToHtml = (markdown: string): string => {
  const lines = markdown.split('\n');
  let result: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    // Headers (check first, before other processing)
    if (trimmed.startsWith('### ')) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      result.push(`<h3 class="text-lg font-semibold mt-4 mb-2">${trimmed.substring(4)}</h3>`);
      continue;
    } else if (trimmed.startsWith('## ')) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      result.push(`<h2 class="text-xl font-bold mt-6 mb-3">${trimmed.substring(3)}</h2>`);
      continue;
    } else if (trimmed.startsWith('# ')) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      result.push(`<h1 class="text-2xl font-bold mt-8 mb-4">${trimmed.substring(2)}</h1>`);
      continue;
    }

    // Lists
    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      if (!inList) {
        result.push('<ul class="list-disc list-inside space-y-1 my-2 ml-4">');
        inList = true;
      }
      let listItem = listMatch[1];
      // Process bold and italic in list items
      listItem = listItem.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      listItem = listItem.replace(/\*(.+?)\*/g, '<em>$1</em>');
      result.push(`<li>${listItem}</li>`);
      continue;
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
    }

    // Regular paragraphs
    if (trimmed) {
      let processed = trimmed;
      // Process bold first (to avoid conflicts with italic)
      processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // Process italic (simple single asterisks, avoiding bold markers)
      // Replace single *text* but not **text** by doing it after bold replacement
      processed = processed.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
      result.push(`<p class="mb-2">${processed}</p>`);
    } else if (i < lines.length - 1) {
      // Empty line (but not the last line)
      result.push('<br>');
    }
  }

  if (inList) {
    result.push('</ul>');
  }

  return result.join('');
};

export default function Workbench() {
  const { toast } = useToast();

  // Check for Google OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    const authSuccess = urlParams.get('auth');

    if (sessionId && authSuccess === 'success') {
      setGoogleSessionId(sessionId);
      toast({
        title: "Google Calendar Connected!",
        description: "You can now sync events directly to your calendar.",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);
  const [activeTab, setActiveTab] = useState("strategy");
  const [loading, setLoading] = useState(false);

  // Store results per tab to keep them when switching tabs
  const [strategyResult, setStrategyResult] = useState<any>(null);
  const [automationResult, setAutomationResult] = useState<any>(null);

  // Strategy inputs
  const [market, setMarket] = useState("");
  const [segment, setSegment] = useState("");
  const [goals, setGoals] = useState("");
  const [constraints, setConstraints] = useState("");

  // Customer Advisory chat
  const [customerMessages, setCustomerMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [customerMessageInput, setCustomerMessageInput] = useState("");
  const [customerAdvisoryLoading, setCustomerAdvisoryLoading] = useState(false);

  // Automation state
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [googleSessionId, setGoogleSessionId] = useState<string | null>(null);

  // Audio Summary state
  const [audioSummaryLoading, setAudioSummaryLoading] = useState(false);
  const [audioSummary, setAudioSummary] = useState<{ audioBase64: string; summaryText: string } | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Voice Assistant state
  const [voiceAssistantMessages, setVoiceAssistantMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; audioBase64?: string }>>([]);
  const [voiceAssistantInput, setVoiceAssistantInput] = useState("");
  const [voiceAssistantLoading, setVoiceAssistantLoading] = useState(false);
  const [voiceAssistantPlaying, setVoiceAssistantPlaying] = useState<string | null>(null);

  const handleStrategy = async () => {
    setLoading(true);
    setStrategyResult(null);
    try {
      const response = await runStrategyAgent({
        market,
        segment,
        goals: goals.split('\n').filter(Boolean),
        constraints: constraints.split('\n').filter(Boolean),
      });
      setStrategyResult(response);
      setActiveTab("strategy"); // Ensure we're on the strategy tab
      toast({
        title: "Strategy Generated",
        description: "Your product strategy brief is ready",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerAdvisoryMessage = async () => {
    if (!customerMessageInput.trim()) return;

    const userMessage = customerMessageInput.trim();
    setCustomerMessageInput("");

    // Add user message to chat
    const newMessages = [...customerMessages, { role: 'user' as const, content: userMessage }];
    setCustomerMessages(newMessages);
    setCustomerAdvisoryLoading(true);

    try {
      // Get customer segment from strategy result if available
      const customerSegment = strategyResult?.data?.icps?.[0]?.segment || '';
      const market = strategyResult?.data?.marketOpportunity ? 'from strategy' : '';

      const response = await runCustomerAdvisoryAgent({
        message: userMessage,
        conversationHistory: newMessages,
        customerSegment: customerSegment || undefined,
        market: market || undefined,
      });

      // Add assistant response to chat
      setCustomerMessages([...newMessages, { role: 'assistant' as const, content: response.data.message }]);
      setActiveTab("customer-advisory");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      // Remove the user message if error occurred
      setCustomerMessages(customerMessages);
    } finally {
      setCustomerAdvisoryLoading(false);
    }
  };

  const clearCustomerChat = () => {
    setCustomerMessages([]);
    toast({
      title: "Chat Cleared",
      description: "Conversation history has been reset",
    });
  };

  const handleSyncCalendar = async () => {
    // Check if strategy and customer messages exist
    if (!strategyResult?.data) {
      toast({
        title: "Strategy Required",
        description: "Please generate a strategy first before syncing to calendar.",
        variant: "destructive",
      });
      return;
    }

    if (!customerMessages || customerMessages.length === 0) {
      toast({
        title: "Customer Chat Required",
        description: "Please have a conversation with the customer chatbot first.",
        variant: "destructive",
      });
      return;
    }

    setSyncingCalendar(true);
    setAutomationResult(null);

    try {
      const response = await syncCalendar({
        strategyData: strategyResult.data,
        customerMessages: customerMessages,
        sessionId: googleSessionId || undefined,
      });

      setAutomationResult(response);
      setActiveTab("automation");

      // If authentication is needed
      if (response.needsAuth) {
        toast({
          title: "Google Calendar Authorization Required",
          description: "Redirecting to Google to authorize calendar access...",
        });
        // Directly start OAuth flow
        window.location.href = "http://localhost:8787/api/auth/google";
        return;
      }


      // If events were created automatically, open Google Calendar
      if (response.data.eventsCreated && response.data.eventsCreated > 0) {
        // Events were created automatically via API
        window.open(response.data.googleCalendarUrl || 'https://calendar.google.com/calendar/u/0/r', '_blank');
        toast({
          title: "Events Created!",
          description: `Successfully created ${response.data.eventsCreated} events in your Google Calendar! Opening calendar now...`,
        });
      } else {
        toast({
          title: "Schedule Generated",
          description: response.data.message || "Schedule generated successfully.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handleGenerateAudioSummary = async () => {
    // Check if we have any data to summarize
    if (!strategyResult?.data && customerMessages.length === 0 && !automationResult?.data?.plan) {
      toast({
        title: "No Data Available",
        description: "Please generate strategy, customer chat, or automation schedule first.",
        variant: "destructive",
      });
      return;
    }

    setAudioSummaryLoading(true);
    setAudioSummary(null);

    try {
      const response = await generateAudioSummary({
        strategyData: strategyResult?.data,
        customerMessages: customerMessages,
        automationPlan: automationResult?.data?.plan,
      });

      setAudioSummary({
        audioBase64: response.data.audioBase64,
        summaryText: response.data.summaryText,
      });

      toast({
        title: "Audio Summary Generated!",
        description: "Your workbench summary is ready. Click play to listen.",
      });
    } catch (error: any) {
      let errorMessage = error.message || "Failed to generate audio summary.";

      // Provide helpful guidance for 401 errors
      if (errorMessage.includes("401") || errorMessage.includes("Unauthorized") || errorMessage.includes("Invalid API key")) {
        errorMessage += " Please verify your ElevenLabs API key is correct and active. Get your API key from: https://elevenlabs.io/app/settings/api-keys";
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setAudioSummaryLoading(false);
    }
  };

  const handlePlayAudio = () => {
    if (!audioSummary) return;

    if (audioPlaying && audioElement) {
      // Pause
      audioElement.pause();
      setAudioPlaying(false);
    } else {
      // Play
      const audio = new Audio(`data:audio/mpeg;base64,${audioSummary.audioBase64}`);
      audio.play();
      setAudioElement(audio);
      setAudioPlaying(true);

      audio.onended = () => {
        setAudioPlaying(false);
        setAudioElement(null);
      };

      audio.onerror = () => {
        toast({
          title: "Audio Error",
          description: "Failed to play audio. Please try generating again.",
          variant: "destructive",
        });
        setAudioPlaying(false);
        setAudioElement(null);
      };
    }
  };

  const handleDownloadAudio = () => {
    if (!audioSummary) return;

    const audioBlob = new Blob(
      [Uint8Array.from(atob(audioSummary.audioBase64), c => c.charCodeAt(0))],
      { type: 'audio/mpeg' }
    );
    const url = URL.createObjectURL(audioBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `syntria-workbench-summary-${new Date().toISOString().split('T')[0]}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Audio Downloaded",
      description: "Your workbench summary audio has been downloaded.",
    });
  };

  const handleVoiceAssistantQuestion = async () => {
    if (!voiceAssistantInput.trim()) return;

    const question = voiceAssistantInput.trim();
    setVoiceAssistantInput("");
    setVoiceAssistantLoading(true);

    // Add user message to conversation
    const userMessage = { role: 'user' as const, content: question };
    setVoiceAssistantMessages(prev => [...prev, userMessage]);

    try {
      const response = await askVoiceAssistant({
        question: question,
        strategyData: strategyResult?.data,
        customerMessages: customerMessages,
        automationPlan: automationResult?.data?.plan,
        conversationHistory: voiceAssistantMessages,
      });

      // Add assistant response to conversation
      const assistantMessage = {
        role: 'assistant' as const,
        content: response.data.answer,
        audioBase64: response.data.audioBase64,
      };
      setVoiceAssistantMessages(prev => [...prev, assistantMessage]);

      // Auto-play the audio response
      if (response.data.audioBase64) {
        const audio = new Audio(`data:audio/mpeg;base64,${response.data.audioBase64}`);
        const questionId = `msg-${voiceAssistantMessages.length}`;
        setVoiceAssistantPlaying(questionId);
        audio.play();

        audio.onended = () => {
          setVoiceAssistantPlaying(null);
        };

        audio.onerror = () => {
          setVoiceAssistantPlaying(null);
          toast({
            title: "Audio Error",
            description: "Failed to play audio response.",
            variant: "destructive",
          });
        };
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to get response from voice assistant.",
        variant: "destructive",
      });
      // Remove the user message if there was an error
      setVoiceAssistantMessages(prev => prev.slice(0, -1));
    } finally {
      setVoiceAssistantLoading(false);
    }
  };

  const handlePlayVoiceResponse = (audioBase64: string, questionId: string) => {
    if (voiceAssistantPlaying === questionId) {
      // Stop playing
      setVoiceAssistantPlaying(null);
      return;
    }

    const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
    setVoiceAssistantPlaying(questionId);
    audio.play();

    audio.onended = () => {
      setVoiceAssistantPlaying(null);
    };

    audio.onerror = () => {
      setVoiceAssistantPlaying(null);
      toast({
        title: "Audio Error",
        description: "Failed to play audio.",
        variant: "destructive",
      });
    };
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">PM Workbench</h1>
          <p className="text-muted-foreground">AI agents for product strategy, customer insights, and automation</p>
        </div>
        {(strategyResult || customerMessages.length > 0 || automationResult) && (
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export All
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto">
          <TabsTrigger value="strategy" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Strategy
          </TabsTrigger>
          <TabsTrigger value="customer-advisory" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Customer Advisory
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Automation
          </TabsTrigger>
          <TabsTrigger value="audio-summary" className="flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            Voice Assistant
          </TabsTrigger>
        </TabsList>

        <TabsContent value="strategy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Strategy Agent</CardTitle>
              <CardDescription>
                Generate product brief, North Star metrics, and success criteria
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="market">Target Market</Label>
                  <Input
                    id="market"
                    placeholder="e.g., Enterprise SaaS"
                    value={market}
                    onChange={(e) => setMarket(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="segment">Customer Segment</Label>
                  <Input
                    id="segment"
                    placeholder="e.g., Mid-market CFOs"
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goals">Goals (one per line)</Label>
                <Textarea
                  id="goals"
                  placeholder="Increase user retention&#10;Reduce time to value&#10;Expand into new verticals"
                  className="min-h-[100px]"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="constraints">Constraints (one per line)</Label>
                <Textarea
                  id="constraints"
                  placeholder="Must comply with SOC 2&#10;Limited engineering resources&#10;Q2 launch deadline"
                  className="min-h-[100px]"
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                />
              </div>

              <Button onClick={handleStrategy} disabled={loading || !market}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Generate Strategy
              </Button>
            </CardContent>
          </Card>

          {strategyResult && strategyResult.data && (
            <div className="space-y-6">
              {/* Executive Summary */}
              {strategyResult.data.executiveSummary && (
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Star className="w-5 h-5 text-blue-500" />
                      Executive Summary
                    </CardTitle>
                    <CardDescription>Strategic overview of the product opportunity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert text-base leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: markdownToHtml(strategyResult.data.executiveSummary)
                      }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* North Star Metric */}
              {strategyResult.data.northStar && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-500" />
                      North Star Metric
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-medium">{strategyResult.data.northStar}</p>
                  </CardContent>
                </Card>
              )}

              {/* Market Opportunity */}
              {strategyResult.data.marketOpportunity && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-green-500" />
                      Market Opportunity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{
                        __html: markdownToHtml(strategyResult.data.marketOpportunity)
                      }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Competitive Landscape */}
              {strategyResult.data.competitiveLandscape && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-500" />
                      Competitive Landscape
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{
                        __html: markdownToHtml(strategyResult.data.competitiveLandscape)
                      }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Strategic Recommendations */}
              {strategyResult.data.strategicRecommendations && strategyResult.data.strategicRecommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-orange-500" />
                      Strategic Recommendations
                    </CardTitle>
                    <CardDescription>Key strategic advice for product development</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {strategyResult.data.strategicRecommendations.map((rec: string, index: number) => (
                        <li key={index} className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mt-0.5">
                            <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">{index + 1}</span>
                          </div>
                          <span className="flex-1">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* ICPs */}
              {strategyResult.data.icps && strategyResult.data.icps.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-500" />
                      Ideal Customer Profiles (ICPs)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {strategyResult.data.icps.map((icp: any, index: number) => (
                      <div key={index} className="space-y-3">
                        {icp.segment && (
                          <h4 className="font-semibold text-lg">{icp.segment}</h4>
                        )}
                        {icp.description && (
                          <p className="text-sm text-muted-foreground">{icp.description}</p>
                        )}
                        {icp.painPoints && icp.painPoints.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Pain Points:</p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                              {icp.painPoints.map((pain: string, i: number) => (
                                <li key={i} className="text-sm">{pain}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {icp.opportunities && icp.opportunities.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Opportunities:</p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                              {icp.opportunities.map((opp: string, i: number) => (
                                <li key={i} className="text-sm">{opp}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {icp.buyingBehavior && (
                          <div>
                            <p className="text-sm font-medium mb-2">Buying Behavior:</p>
                            <p className="text-sm text-muted-foreground">{icp.buyingBehavior}</p>
                          </div>
                        )}
                        {index < strategyResult.data.icps.length - 1 && <Separator className="my-4" />}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Success Metrics */}
              {strategyResult.data.successMetrics && strategyResult.data.successMetrics.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Success Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {strategyResult.data.successMetrics.map((metric: any, index: number) => (
                        <li key={index} className="space-y-1">
                          {typeof metric === 'string' ? (
                            <div className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{metric}</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <span className="font-medium">{metric.metric}</span>
                                  {metric.target && (
                                    <span className="text-muted-foreground ml-2">— {metric.target}</span>
                                  )}
                                </div>
                              </div>
                              {metric.rationale && (
                                <p className="text-sm text-muted-foreground ml-6">{metric.rationale}</p>
                              )}
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Go-to-Market Considerations */}
              {strategyResult.data.goToMarketConsiderations && strategyResult.data.goToMarketConsiderations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-indigo-500" />
                      Go-to-Market Considerations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {strategyResult.data.goToMarketConsiderations.map((gtm: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <Target className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                          <span>{gtm}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Risks and Challenges */}
              {strategyResult.data.risksAndChallenges && strategyResult.data.risksAndChallenges.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      Risks and Challenges
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {strategyResult.data.risksAndChallenges.map((risk: any, index: number) => (
                      <div key={index} className="space-y-1 p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{typeof risk === 'string' ? risk : risk.risk}</span>
                          {risk.impact && (
                            <Badge variant={risk.impact === 'high' ? 'destructive' : risk.impact === 'medium' ? 'default' : 'secondary'}>
                              {risk.impact} impact
                            </Badge>
                          )}
                        </div>
                        {risk.mitigation && (
                          <p className="text-sm text-muted-foreground mt-1">
                            <span className="font-medium">Mitigation: </span>{risk.mitigation}
                          </p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Timeline and Milestones */}
              {strategyResult.data.timelineAndMilestones && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-500" />
                      Timeline and Milestones
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{
                        __html: markdownToHtml(strategyResult.data.timelineAndMilestones)
                      }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Constraints */}
              {strategyResult.data.constraints && strategyResult.data.constraints.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-500" />
                      Constraints
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {strategyResult.data.constraints.map((constraint: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                          <span>{constraint}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Product Requirements Document */}
              {strategyResult.data.prd && (
                <Card>
                  <CardHeader>
                    <CardTitle>Product Requirements Document (PRD)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{
                        __html: markdownToHtml(strategyResult.data.prd)
                      }}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="customer-advisory" className="space-y-6">
          <Card className="flex flex-col" style={{ height: 'calc(100vh - 250px)' }}>
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Customer Chat
                  </CardTitle>
                  <CardDescription>
                    Chat with an AI that acts like your target customer to understand their needs, pain points, and feedback
                  </CardDescription>
                </div>
                {customerMessages.length > 0 && (
                  <Button variant="outline" size="sm" onClick={clearCustomerChat}>
                    Clear Chat
                  </Button>
                )}
              </div>
              {strategyResult?.data?.icps?.[0]?.segment && (
                <div className="mt-2">
                  <Badge variant="secondary">
                    Persona: {strategyResult.data.icps[0].segment}
                  </Badge>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden p-4">
              <ScrollArea className="flex-1 pr-2">
                <div className="space-y-4">
                  {customerMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8 text-muted-foreground">
                      <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">Start a conversation with your customer</p>
                      <p className="text-sm mb-4">Ask questions to understand their needs, pain points, and experiences</p>
                      <div className="text-left space-y-2 text-sm bg-muted/50 p-4 rounded-lg max-w-md">
                        <p className="font-medium mb-2">Example questions:</p>
                        <ul className="space-y-1 list-disc list-inside">
                          <li>"What's your biggest pain point with current solutions?"</li>
                          <li>"How do you currently solve this problem?"</li>
                          <li>"What features would make you switch to a new product?"</li>
                          <li>"What frustrates you most about existing tools?"</li>
                          <li>"Tell me about your workflow and daily tasks"</li>
                        </ul>
                      </div>
                    </div>
                  )}
                  {customerMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted border'
                          }`}
                      >
                        <div className="text-xs font-medium mb-1 opacity-70">
                          {msg.role === 'user' ? 'You (PM)' : 'Customer'}
                        </div>
                        <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                  {customerAdvisoryLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted border rounded-lg p-4 max-w-[80%]">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Customer is typing...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="flex gap-2 flex-shrink-0">
                <Textarea
                  placeholder="Ask your customer a question... (e.g., 'What's your biggest pain point?')"
                  value={customerMessageInput}
                  onChange={(e) => setCustomerMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleCustomerAdvisoryMessage();
                    }
                  }}
                  className="min-h-[80px] resize-none"
                  disabled={customerAdvisoryLoading}
                />
                <Button
                  onClick={handleCustomerAdvisoryMessage}
                  disabled={customerAdvisoryLoading || !customerMessageInput.trim()}
                  className="px-6 self-end"
                >
                  {customerAdvisoryLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Send'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Automation Agent</CardTitle>
              <CardDescription>
                Generate a 2-week schedule based on your strategy and customer insights, then sync to Google Calendar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Requirements Check */}
              <div className="space-y-3">
                <div className={`p-4 rounded-lg border ${strategyResult?.data ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'}`}>
                  <div className="flex items-center gap-2">
                    {strategyResult?.data ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                    <span className="font-medium">
                      {strategyResult?.data ? 'Strategy Generated' : 'Strategy Required'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {strategyResult?.data
                      ? 'Your product strategy is ready to use'
                      : 'Generate a strategy first to create your schedule'}
                  </p>
                </div>

                <div className={`p-4 rounded-lg border ${customerMessages.length > 0 ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'}`}>
                  <div className="flex items-center gap-2">
                    {customerMessages.length > 0 ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                    <span className="font-medium">
                      {customerMessages.length > 0 ? 'Customer Chat Complete' : 'Customer Chat Required'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {customerMessages.length > 0
                      ? `${customerMessages.length} messages in your customer conversation`
                      : 'Have a conversation with the customer chatbot to gather insights'}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleSyncCalendar}
                disabled={syncingCalendar || !strategyResult?.data || customerMessages.length === 0}
                className="w-full"
                size="lg"
              >
                {syncingCalendar ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {googleSessionId ? 'Creating Events...' : 'Generating Schedule...'}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    {googleSessionId ? 'Sync to Google Calendar' : 'Sync Calendar'}
                  </>
                )}
              </Button>

              {googleSessionId && (
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-green-800 dark:text-green-200">Google Calendar connected - events will be created automatically!</span>
                  </div>
                </div>
              )}

              {(!strategyResult?.data || customerMessages.length === 0) && (
                <p className="text-sm text-muted-foreground text-center">
                  Complete the Strategy and Customer Advisory sections first to generate your schedule
                </p>
              )}

              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  📅 How it works:
                </p>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                  <li>Analyzes your product strategy and customer insights</li>
                  <li>Generates a personalized 2-week schedule</li>
                  <li>Creates calendar events automatically</li>
                  <li>Opens Google Calendar with your events ready to save</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {automationResult && automationResult.data && (
            <div className="space-y-6">
              {/* Success Message */}
              {automationResult.data.message && (
                <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Schedule Generated Successfully!
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm">{automationResult.data.message}</p>

                    {/* Events created automatically */}
                    {automationResult.data.eventsCreated && automationResult.data.eventsCreated > 0 ? (
                      <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                          ✅ Events Created Automatically!
                        </p>
                        <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                          {automationResult.data.eventsCreated} events have been automatically added to your Google Calendar. No file download needed!
                        </p>
                        <Button
                          onClick={() => window.open('https://calendar.google.com/calendar/u/0/r', '_blank')}
                          className="w-full sm:w-auto"
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Open Google Calendar
                        </Button>
                      </div>
                    ) : (
                      <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                          📅 Schedule Generated
                        </p>
                        <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                          {automationResult.data.message || 'Schedule generated successfully.'}
                        </p>
                        {automationResult.data.plan && (
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            {automationResult.data.plan.length} days planned with {automationResult.data.calendarEvents?.length || 0} events.
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 2-Week Plan */}
              {automationResult.data.plan && automationResult.data.plan.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>2-Week Plan</CardTitle>
                    <CardDescription>
                      Daily tasks and milestones to achieve your goal
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {automationResult.data.plan.map((item: any, index: number) => (
                        <div key={index} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Day {item.day || index + 1}</Badge>
                              {item.status && (
                                <Badge variant={item.status === 'completed' ? 'default' : 'secondary'}>
                                  {item.status}
                                </Badge>
                              )}
                            </div>
                            {item.date && (
                              <span className="text-sm text-muted-foreground">{item.date}</span>
                            )}
                          </div>
                          <p className="font-medium">{item.task || item.title || item.description}</p>
                          {item.details && (
                            <p className="text-sm text-muted-foreground">{item.details}</p>
                          )}
                          {item.duration && (
                            <p className="text-xs text-muted-foreground">Duration: {item.duration}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Calendar Events Preview */}
              {automationResult.data.calendarEvents && automationResult.data.calendarEvents.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-blue-500" />
                      Calendar Events Preview
                    </CardTitle>
                    <CardDescription>
                      {automationResult.data.calendarEvents.length} event(s) will be created. Download the calendar file above to import them.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {automationResult.data.calendarEvents.map((event: any, index: number) => (
                        <div key={index} className="border rounded-lg p-3 space-y-1">
                          <p className="font-medium">{event.title || event.summary}</p>
                          {event.date && (
                            <p className="text-sm text-muted-foreground">
                              Date: {new Date(event.date).toLocaleDateString()} at 9:00 AM
                            </p>
                          )}
                          {event.description && (
                            <p className="text-sm text-muted-foreground">{event.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Voice Assistant Tab */}
        <TabsContent value="audio-summary" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-blue-500" />
                Voice Assistant
              </CardTitle>
              <CardDescription>
                Ask questions about your strategy, schedule, and customer insights. Get voice responses!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Requirements Check */}
              <div className="space-y-3">
                <div className={`p-4 rounded-lg border ${strategyResult?.data || customerMessages.length > 0 || automationResult?.data?.plan ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'}`}>
                  <div className="flex items-center gap-2">
                    {strategyResult?.data || customerMessages.length > 0 || automationResult?.data?.plan ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                    <span className="font-medium">
                      {strategyResult?.data || customerMessages.length > 0 || automationResult?.data?.plan ? 'Data Available' : 'No Data Available'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {strategyResult?.data || customerMessages.length > 0 || automationResult?.data?.plan
                      ? 'Ask questions about your workbench data'
                      : 'Generate strategy, customer chat, or automation schedule first to ask questions'}
                  </p>
                </div>
              </div>

              {/* Chat Interface */}
              <div className="space-y-4">
                <ScrollArea className="h-96 border rounded-lg p-4">
                  {voiceAssistantMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                      <Volume2 className="w-12 h-12 text-muted-foreground" />
                      <div>
                        <p className="font-medium mb-2">Ask me anything about your workbench!</p>
                        <div className="text-sm text-muted-foreground space-y-2">
                          <p>💡 Example questions:</p>
                          <ul className="list-disc list-inside space-y-1 text-left">
                            <li>"When do I have meetings this week?"</li>
                            <li>"What plans do I have for Monday?"</li>
                            <li>"What's my North Star metric?"</li>
                            <li>"What are the key customer insights?"</li>
                            <li>"What strategic recommendations do I have?"</li>
                            <li>"What tasks are scheduled for Day 3?"</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {voiceAssistantMessages.map((msg, index) => (
                        <div
                          key={index}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                              }`}
                          >
                            <div className="text-sm font-medium mb-1">
                              {msg.role === 'user' ? 'You' : 'Assistant'}
                            </div>
                            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                            {msg.role === 'assistant' && msg.audioBase64 && (
                              <div className="mt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePlayVoiceResponse(msg.audioBase64!, `msg-${index}`)}
                                >
                                  {voiceAssistantPlaying === `msg-${index}` ? (
                                    <>
                                      <Pause className="w-3 h-3 mr-1" />
                                      Pause
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-3 h-3 mr-1" />
                                      Play Audio
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {voiceAssistantLoading && (
                        <div className="flex justify-start">
                          <div className="bg-muted rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-sm">Assistant is thinking...</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>

                <div className="flex gap-2">
                  <Input
                    value={voiceAssistantInput}
                    onChange={(e) => setVoiceAssistantInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleVoiceAssistantQuestion();
                      }
                    }}
                    placeholder="Ask a question about your workbench data..."
                    disabled={voiceAssistantLoading || (!strategyResult?.data && customerMessages.length === 0 && !automationResult?.data?.plan)}
                  />
                  <Button
                    onClick={handleVoiceAssistantQuestion}
                    disabled={voiceAssistantLoading || !voiceAssistantInput.trim() || (!strategyResult?.data && customerMessages.length === 0 && !automationResult?.data?.plan)}
                  >
                    {voiceAssistantLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageSquare className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  🎙️ How it works:
                </p>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                  <li>Ask questions about your strategy, schedule, or customer insights</li>
                  <li>Get intelligent answers based on your workbench data</li>
                  <li>Listen to voice responses automatically</li>
                  <li>Perfect for quick updates on the go</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
