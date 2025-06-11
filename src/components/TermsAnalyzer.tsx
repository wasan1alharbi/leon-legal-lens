
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import LeonMascot from './LeonMascot';

interface GPTAnalysisResult {
  score: number;
  phrases: {
    text: string;
    reason: string;
    category: string;
  }[];
  summary: string[];
}

interface AnalysisResult {
  shadinessScore: number;
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
  const [error, setError] = useState<string | null>(null);

  const analyzeWithGPT = async (text: string): Promise<GPTAnalysisResult> => {
    try {
      const response = await fetch('/api/analyze-terms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ terms: text }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze terms');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('GPT Analysis failed:', error);
      throw error;
    }
  };

  const fallbackAnalyze = (text: string): AnalysisResult => {
    const lowerText = text.toLowerCase();
    
    const riskPatterns = [
      { pattern: /we may collect|we collect|data collection/g, risk: 'high' },
      { pattern: /third.party|third party|share.*information/g, risk: 'high' },
      { pattern: /cookies|tracking|analytics/g, risk: 'medium' },
      { pattern: /you agree|binding arbitration|waive.*rights/g, risk: 'high' },
      { pattern: /no refund|non.refundable|final sale/g, risk: 'medium' },
      { pattern: /terminate.*account|suspend.*service/g, risk: 'medium' },
      { pattern: /modify.*terms|change.*agreement/g, risk: 'low' },
      { pattern: /liability.*limited|not responsible/g, risk: 'high' },
      { pattern: /indemnify|hold.*harmless/g, risk: 'high' },
    ];

    let shadinessScore = 0;
    const riskyPhrases: string[] = [];
    const categories = {
      givingUp: [] as string[],
      risks: [] as string[],
      payments: [] as string[]
    };

    riskPatterns.forEach(({ pattern, risk }) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => riskyPhrases.push(match));
        
        const riskValue = risk === 'high' ? 25 : risk === 'medium' ? 15 : 10;
        shadinessScore += riskValue * matches.length;

        if (pattern.source.includes('collect|share|cookies|tracking')) {
          categories.givingUp.push(`Your ${matches[0].includes('data') ? 'personal data' : 'browsing activity'} may be collected`);
        } else if (pattern.source.includes('refund|payment|final')) {
          categories.payments.push(`${matches[0].includes('refund') ? 'Refunds may be restricted' : 'Payment terms apply'}`);
        } else {
          categories.risks.push(`You may ${matches[0].includes('agree') ? 'waive certain rights' : 'face account restrictions'}`);
        }
      }
    });

    shadinessScore = Math.min(100, shadinessScore);

    return {
      shadinessScore,
      categories,
      riskyPhrases
    };
  };

  const handleAnalyze = async () => {
    if (!termsText.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      // Try GPT analysis first
      const gptResult = await analyzeWithGPT(termsText);
      
      // Convert GPT result to our format
      const categories = {
        givingUp: [] as string[],
        risks: [] as string[],
        payments: [] as string[]
      };

      gptResult.phrases.forEach(phrase => {
        switch (phrase.category) {
          case 'Data Privacy':
            categories.givingUp.push(phrase.reason);
            break;
          case 'Legal Rights':
            categories.risks.push(phrase.reason);
            break;
          case 'Refunds & Payments':
            categories.payments.push(phrase.reason);
            break;
          default:
            categories.risks.push(phrase.reason);
        }
      });

      const result: AnalysisResult = {
        shadinessScore: gptResult.score,
        categories,
        riskyPhrases: gptResult.phrases.map(p => p.text),
        gptAnalysis: gptResult
      };

      setAnalysis(result);
    } catch (error) {
      console.error('GPT analysis failed, using fallback:', error);
      // Fall back to rule-based analysis
      const fallbackResult = fallbackAnalyze(termsText);
      setAnalysis(fallbackResult);
      setError('Using basic analysis (GPT unavailable)');
    }
    
    setIsAnalyzing(false);
    setShowResults(true);
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
                  {error && (
                    <p className="mt-2 text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                      {error}
                    </p>
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
                          Analyzing with AI...
                        </>
                      ) : (
                        'Check it for me pls 🐤'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <LeonMascot 
                message={isAnalyzing ? "Sending this to my AI friend... 🤖" : "Ready to dive into some legal text! 🦆"} 
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
                        <p>Score based on AI analysis of your pasted terms</p>
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
              {analysis?.gptAnalysis && (
                <Card className="bg-white shadow-lg border-2 border-red-100">
                  <CardHeader>
                    <CardTitle className="text-xl text-gray-800 flex items-center gap-2">
                      ⚠️ Key Risks Found
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
                            {item}
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
                            {item}
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
                            {item}
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
                    setError(null);
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
                    ? (analysis.shadinessScore <= 30 
                        ? "AI says these folks seem pretty trustworthy! 😌"
                        : analysis.shadinessScore <= 70
                        ? "AI found some things to watch out for 🤔"
                        : "Whoa, AI thinks these terms are quite risky! 😬")
                    : (analysis?.shadinessScore || 0) <= 30 
                    ? "All clear! These folks seem chill 😌"
                    : (analysis?.shadinessScore || 0) <= 70
                    ? "Hmm, some things to watch out for 🤔"
                    : "Whoa, these terms are kinda sus 😬"
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
