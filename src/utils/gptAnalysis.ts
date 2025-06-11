
// This file contains the GPT analysis logic that will be moved to a Supabase Edge Function

export const GPT_ANALYSIS_PROMPT = `You're an assistant that analyzes Terms & Conditions.

Given the following pasted terms, extract:

1. A list of **shady or concerning phrases** (3–8 max), each with:
   - The **exact phrase** from the T&Cs
   - A **short explanation** of why it might be problematic
   - A **risk category** (choose from: Data Privacy, Legal Rights, Refunds & Payments, User Control)

2. A **Shadiness Score** from 0 to 100 based on severity and quantity of issues:
   - 0–30 = Safe 😇
   - 31–70 = Medium 😐
   - 71–100 = High Risk 😬

3. A **bullet-point summary** of what the user is agreeing to (simplified)

Return your response as JSON in this exact format:
{
  "score": number,
  "phrases": [
    {
      "text": "exact phrase from terms",
      "reason": "short explanation",
      "category": "one of the four categories"
    }
  ],
  "summary": ["bullet point 1", "bullet point 2", "bullet point 3"]
}

Here are the Terms:
---
{TERMS_TEXT}
---`;

// This function will be implemented in a Supabase Edge Function
export async function analyzeTermsWithGPT(terms: string, apiKey: string) {
  const prompt = GPT_ANALYSIS_PROMPT.replace('{TERMS_TEXT}', terms);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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

  try {
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to parse GPT response as JSON:', content);
    throw new Error('Invalid JSON response from GPT');
  }
}
