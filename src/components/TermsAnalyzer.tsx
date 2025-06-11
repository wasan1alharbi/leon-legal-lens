import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import LeonMascot from './LeonMascot';

interface GPTAnalysisResult {
  score: number;
  reasoning: string;
  phrases: {
    text: string;
    reason: string;
    category: string;
  }[];
  summary: string[];
}

interface AnalysisResult {
  shadinessScore: number;
  reasoning: string;
  categories: {
    givingUp: string[];
    risks: string[];
    payments: string[];
  };
  riskyPhrases: string[];
  gptAnalysis?: GPTAnalysisResult;
}

const TermsAnalyzer = () => {
  const [termsText, setTermsText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [highlightRisky, setHighlightRisky] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const { toast } = useToast();

  const analyzeWithGPT = async (text: string, openaiApiKey: string): Promise<GPTAnalysisResult> => {
    const prompt = `You're a legal-simplifying assistant.
Analyze the following Terms & Conditions and return:

1. A Shadiness Score (0–100)
2. A short reasoning behind the score
3. A list of 3–7 concerning phrases, with:
   - Exact text
   - Short explanation
   - Category (choose from: Data Privacy, Legal Rights, Refunds & Payments, User Control)
4. A simplified bullet-point summary of what the user is agreeing to

Return your answer in this JSON format:
{
  "score": 80,
  "reasoning": "Strict refund policy, mandatory arbitration, and vague data-sharing terms.",
  "phrases": [
    {
      "text": "All sales are final.",
      "reason": "No refund policy",
      "category": "Refunds & Payments"
    }
  ],
  "summary": [
    "You give up refund rights",
    "You allow third-party data sharing",
    "You waive your right to sue"
  ]
}

Here are the Terms:
---
${text}
---`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 700,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const result = JSON.parse(content);
      
      // Adjust score based on number of issues found
      const issueCount = result.phrases?.length || 0;
      let adjustedScore = result.score;
      
      if (issueCount >= 5) {
        adjustedScore = Math.min(100, adjustedScore + 10);
      } else if (issueCount <= 2) {
        adjustedScore = Math.max(0, adjustedScore - 15);
      }
      
      return {
        ...result,
        score: adjustedScore
      };
    } catch (error) {
      console.error('GPT Analysis failed:', error);
      throw error;
    }
  };

  const fallbackAnalyze = (text: string): AnalysisResult => {
    const lowerText = text.toLowerCase();
    
    const riskPatterns = [
      { pattern: /we may collect|we collect|collect.*data|personal information/gi, category: 'Data Privacy', severity: 'high' },
      { pattern: /third.?party|share.*information|share.*data/gi, category: 'Data Privacy', severity: 'high' },
      { pattern: /cookies|tracking|analytics/gi, category: 'Data Privacy', severity: 'medium' },
      { pattern: /binding arbitration|waive.*rights|you agree/gi, category: 'Legal Rights', severity: 'high' },
      { pattern: /no refund|non.?refundable|final sale|all sales.*final/gi, category: 'Refunds & Payments', severity: 'high' },
      { pattern: /terminate.*account|suspend.*service/gi, category: 'Legal Rights', severity: 'medium' },
      { pattern: /modify.*terms|change.*agreement/gi, category: 'User Control', severity: 'low' },
      { pattern: /liability.*limited|not responsible|as is/gi, category: 'Legal Rights', severity: 'high' },
    ];

    let shadinessScore = 0;
    const foundIssues: { text: string; category: string; severity: string }[] = [];
    const categories = {
      givingUp: [] as string[],
      risks: [] as string[],
      payments: [] as string[]
    };

    riskPatterns.forEach(({ pattern, category, severity }) => {
      const matches = text.match(pattern);
      if (matches) {
        // Deduplicate matches
        const uniqueMatches = [...new Set(matches)];
        uniqueMatches.forEach(match => {
          foundIssues.push({ text: match, category, severity });
          
          const riskValue = severity === 'high' ? 25 : severity === 'medium' ? 15 : 10;
          shadinessScore += riskValue;

          if (category === 'Data Privacy') {
            categories.givingUp.push(`Your ${match.toLowerCase().includes('data') ? 'personal data' : 'information'} may be collected or shared`);
          } else if (category === 'Refunds & Payments') {
            categories.payments.push(`${match.toLowerCase().includes('refund') ? 'Limited or no refunds' : 'Restrictive payment terms'}`);
          } else {
            categories.risks.push(`You may ${match.toLowerCase().includes('agree') ? 'waive certain legal rights' : 'face account limitations'}`);
          }
        });
      }
    });

    // Deduplicate categories
    categories.givingUp = [...new Set(categories.givingUp)];
    categories.risks = [...new Set(categories.risks)];
    categories.payments = [...new Set(categories.payments)];

    shadinessScore = Math.min(100, shadinessScore);

    return {
      shadinessScore,
      reasoning: foundIssues.length > 0 ? `Found ${foundIssues.length} concerning phrases across ${new Set(foundIssues.map(i => i.category)).size} categories` : 'No major issues detected',
      categories,
      riskyPhrases: foundIssues.map(i => i.text)
    };
  };

  const handleAnalyze = async () => {
    if (!termsText.trim()) {
      toast({
        title: "No text to analyze",
        description: "Please paste some Terms & Conditions first!",
        variant: "destructive"
      });
      return;
    }
    
    setIsAnalyzing(true);
    
    try {
      let result: AnalysisResult;

      if (apiKey.trim()) {
        // Try GPT analysis
        try {
          const gptResult = await analyzeWithGPT(termsText, apiKey);
          
          // Convert GPT result to our format
          const categories = {
            givingUp: [] as string[],
            risks: [] as string[],
            payments: [] as string[]
          };

          // Parse GPT phrases into categories
          gptResult.phrases.forEach(phrase => {
            const item = `"${phrase.text}" - ${phrase.reason}`;
            
            switch (phrase.category) {
              case 'Data Privacy':
                categories.givingUp.push(item);
                break;
              case 'Legal Rights':
              case 'User Control':
                categories.risks.push(item);
                break;
              case 'Refunds & Payments':
                categories.payments.push(item);
                break;
            }
          });

          result = {
            shadinessScore: gptResult.score,
            reasoning: gptResult.reasoning,
            categories,
            riskyPhrases: gptResult.phrases.map(p => p.text),
            gptAnalysis: gptResult
          };

          toast({
            title: "Analysis complete!",
            description: "GPT has analyzed your terms successfully."
          });
        } catch (gptError) {
          console.error('GPT analysis failed, using fallback:', gptError);
          result = fallbackAnalyze(termsText);
          toast({
            title: "Using basic analysis",
            description: "GPT analysis failed, showing rule-based results instead.",
            variant: "destructive"
          });
        }
      } else {
        // Use fallback analysis
        result = fallbackAnalyze(termsText);
        setShowApiKeyInput(true);
        toast({
          title: "Basic analysis complete",
          description: "Add your OpenAI API key for more accurate GPT-powered analysis!"
        });
      }

      setAnalysis(result);
      setShowResults(true);
    } catch (error) {
      console.error('Analysis failed:', error);
      toast({
        title: "Analysis failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getShadinessEmoji = (score: number) => {
    if (score <= 30) return '😇';
    if (score <= 70) return '😐';
    return '😬';
  };

  const getShadinessMessage = (score: number) => {
    if (score <= 30) return 'Pretty trustworthy!';
    if (score <= 70) return 'Proceed with caution';
    return 'Yikes! Read carefully';
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'Data Privacy':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Legal Rights':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Refunds & Payments':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'User Control':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const highlightText = (text: string, phrases: string[]) => {
    if (!highlightRisky || !phrases.length) return text;
    
    let highlightedText = text;
    phrases.forEach(phrase => {
      const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-300 px-1 rounded">$1</mark>');
    });
    
    return highlightedText;
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-cream">
        {/* Header */}
        <header className="text-center py-8 px-4">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-4">
            Click Agree<span className="text-primary">?</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            Let Léon the Legal Duck help you understand those scary Terms & Conditions! 🦆
          </p>
        </header>

        <div className="container mx-auto px-4 pb-8">
          {!showResults ? (
            /* Input Section */
            <div className="max-w-4xl mx-auto space-y-6">
              <Card className="bg-white shadow-lg border-2 border-pastel-blue/30">
                <CardHeader>
                  <CardTitle className="text-2xl text-center text-gray-800">
                    Paste those long, scary T&Cs here… 📄
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={termsText}
                    onChange={(e) => setTermsText(e.target.value)}
                    placeholder="Copy and paste the Terms & Conditions you want me to analyze..."
                    className="min-h-[300px] text-base border-2 border-pastel-blue/50 focus:border-primary transition-colors resize-none"
                  />
                  
                  {showApiKeyInput && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h3 className="font-semibold text-gray-800 mb-2">🔑 Optional: Add OpenAI API Key for GPT Analysis</h3>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        Your API key is used only for this analysis and is not stored.
                      </p>
                    </div>
                  )}

                  <div className="mt-6 text-center">
                    <Button
                      onClick={handleAnalyze}
                      disabled={!termsText.trim() || isAnalyzing}
                      className={`
                        px-8 py-6 text-xl font-semibold rounded-full
                        bg-gradient-to-r from-pastel-blue to-primary
                        hover:from-primary hover:to-pastel-blue
                        hover-glow transition-all duration-300
                        ${isAnalyzing ? '' : 'hover:animate-bounce-gentle'}
                      `}
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="animate-spin h-5 w-5 mr-3 border-2 border-white border-t-transparent rounded-full"></div>
                          {apiKey ? 'Analyzing with GPT...' : 'Analyzing...'}
                        </>
                      ) : (
                        'Check it for me pls 🐤'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <LeonMascot 
                message={isAnalyzing ? (apiKey ? "Sending this to GPT... 🤖" : "Analyzing with my basic rules... 🤓") : "Ready to dive into some legal text! 🦆"} 
                isAnalyzing={isAnalyzing}
              />
            </div>
          ) : (
            /* Results Section */
            <div className="max-w-6xl mx-auto space-y-6 animate-slide-in-up">
              {/* Shadiness Score */}
              <Card className="bg-white shadow-lg border-2 border-pastel-pink/30">
                <CardHeader className="text-center">
                  <CardTitle className="text-3xl text-gray-800 mb-4 flex items-center justify-center gap-3">
                    Shadiness Score: {analysis?.shadinessScore}/100 {getShadinessEmoji(analysis?.shadinessScore || 0)}
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="text-sm text-gray-500 cursor-help">ℹ️</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          {analysis?.reasoning || 'Score based on detected risk patterns'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <div className="relative w-full max-w-md mx-auto">
                    <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full gradient-shadiness rounded-full transition-all duration-1500 ease-out"
                        style={{ width: `${analysis?.shadinessScore || 0}%` }}
                      ></div>
                    </div>
                    <p className="mt-3 text-lg font-medium text-gray-700">
                      {getShadinessMessage(analysis?.shadinessScore || 0)}
                    </p>
                  </div>
                </CardHeader>
              </Card>

              {/* GPT Risk Analysis */}
              {analysis?.gptAnalysis && analysis.gptAnalysis.phrases.length > 0 && (
                <Card className="bg-white shadow-lg border-2 border-red-100">
                  <CardHeader>
                    <CardTitle className="text-xl text-gray-800 flex items-center gap-2">
                      ⚠️ Key Risks Found by GPT
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analysis.gptAnalysis.phrases.map((phrase, index) => (
                        <div key={index} className="border-l-4 border-red-300 pl-4 py-2">
                          <div className="flex items-start gap-2 mb-2">
                            <Badge className={`text-xs ${getCategoryBadgeColor(phrase.category)}`}>
                              {phrase.category}
                            </Badge>
                          </div>
                          <p className="font-medium text-gray-800 mb-1">
                            "{phrase.text}"
                          </p>
                          <p className="text-sm text-gray-600">
                            💬 {phrase.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* No Major Risks Found */}
              {analysis?.gptAnalysis && analysis.gptAnalysis.phrases.length === 0 && (
                <Card className="bg-white shadow-lg border-2 border-green-200">
                  <CardContent className="text-center py-8">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">
                      No major risks found! Looks good 😇
                    </h3>
                    <p className="text-gray-600">
                      This document appears to have standard, reasonable terms.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Category Cards */}
              <div className="grid md:grid-cols-3 gap-6">
                <Card className="bg-white shadow-lg border-2 border-pastel-pink/30 hover:shadow-xl transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-xl text-gray-800 flex items-center gap-2">
                      🧠 What You're Giving Up
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analysis?.categories.givingUp.length ? (
                      <ul className="space-y-2">
                        {analysis.categories.givingUp.map((item, index) => (
                          <li key={index} className="text-gray-700 flex items-start gap-2">
                            <span className="text-orange-500 mt-1">•</span>
                            <span className="text-sm">{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 italic">Nothing concerning found! 😊</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white shadow-lg border-2 border-yellow-200 hover:shadow-xl transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-xl text-gray-800 flex items-center gap-2">
                      ⚠️ Key Risks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analysis?.categories.risks.length ? (
                      <ul className="space-y-2">
                        {analysis.categories.risks.map((item, index) => (
                          <li key={index} className="text-gray-700 flex items-start gap-2">
                            <span className="text-red-500 mt-1">•</span>
                            <span className="text-sm">{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 italic">No major risks detected! ✅</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white shadow-lg border-2 border-pastel-green/50 hover:shadow-xl transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-xl text-gray-800 flex items-center gap-2">
                      💸 Refunds & Payments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analysis?.categories.payments.length ? (
                      <ul className="space-y-2">
                        {analysis.categories.payments.map((item, index) => (
                          <li key={index} className="text-gray-700 flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span className="text-sm">{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 italic">Standard payment terms 💳</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Original Text with Highlighting */}
              <Card className="bg-white shadow-lg border-2 border-pastel-blue/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl text-gray-800">Original Text</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Highlight risky phrases</span>
                      <Switch
                        checked={highlightRisky}
                        onCheckedChange={setHighlightRisky}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div 
                    className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ 
                      __html: highlightText(termsText, analysis?.riskyPhrases || [])
                    }}
                  />
                </CardContent>
              </Card>

              {/* Reset Button */}
              <div className="text-center">
                <Button
                  onClick={() => {
                    setShowResults(false);
                    setTermsText('');
                    setAnalysis(null);
                    setHighlightRisky(false);
                    setShowApiKeyInput(false);
                  }}
                  variant="outline"
                  className="px-6 py-3 border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all"
                >
                  Analyze Another Document 📄
                </Button>
              </div>

              <LeonMascot 
                message={
                  analysis?.gptAnalysis
                    ? (analysis.gptAnalysis.phrases.length === 0
                        ? "GPT says these folks seem pretty trustworthy! 😌"
                        : analysis.shadinessScore <= 30 
                        ? "GPT found some minor things, but overall looks good! 😌"
                        : analysis.shadinessScore <= 70
                        ? "GPT found some things to watch out for 🤔"
                        : "Whoa, GPT thinks these terms are quite risky! 😬")
                    : (analysis?.shadinessScore || 0) <= 30 
                    ? "My basic analysis says these folks seem chill 😌"
                    : (analysis?.shadinessScore || 0) <= 70
                    ? "Hmm, I found some things to watch out for 🤔"
                    : "Whoa, these terms look kinda sus to me 😬"
                } 
                isAnalyzing={false}
              />
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default TermsAnalyzer;

</edits_to_apply>
