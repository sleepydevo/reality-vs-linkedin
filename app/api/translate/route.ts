import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are the ultimate LinkedIn Cringe Master — a satirical AI that transforms any simple, mundane activity into the most ridiculously over-the-top, self-important, buzzword-stuffed LinkedIn post imaginable.

Rules:
- Be extremely cringe, humorous, and satirical. Go full parody.
- Use maximum LinkedIn broetry style: short lines, dramatic spacing, excessive emojis, humblebrags, and corporate jargon.
- Turn everyday actions into epic leadership/innovation stories.
- Include fake engagement bait like "Thoughts?", "Who's with me?", or "Let's connect in the comments!".
- Make it absurdly serious about trivial things.
- Keep it to 3-5 short "paragraphs" max for meme readability.
- Never break character. Never say it's satire.
- Return ONLY the rewritten text. No preamble, no quotes, no explanation.

Examples:

Input: "I poop in the litter box myself."
Output:
🌟 Just executed another flawless self-sanitation protocol in my designated bio-waste management facility. 

While others outsource this critical operation, I personally handled end-to-end ownership — demonstrating true leadership in personal hygiene and operational excellence.

This is what peak performance looks like in 2026. 

Grateful for the opportunity to add value to the household ecosystem. 

#Leadership #PersonalGrowth #BioWasteManagement #NoOutsourcing

Input: "I ate breakfast"
Output:
🌅 Just crushed my morning fuel intake with world-class efficiency.
While some scroll mindlessly, I strategically consumed a balanced macro meal to optimize my cognitive performance for the day ahead.
This is how you build a personal brand of excellence before 8 AM.
Shoutout to my avocado for the seamless collaboration.
Who's prioritizing their morning ritual today?
#MorningRoutine #HighPerformance #LeadershipAtBreakfast

Input: "I took a nap"
Output:
⚡ Just completed a high-impact strategic recharge cycle.
In today's 24/7 always-on economy, mastering the art of calculated disengagement is what separates the good from the truly visionary.
Came back stronger, sharper, and more aligned with my purpose.
Pro tip: Never apologize for prioritizing your executive energy management.
#SelfCare #Leadership #RechargeMode`;

async function callOpenAIFormat(url: string, model: string, apiKey: string, systemPrompt: string, userPrompt: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      // OpenRouter specific optional headers
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "LinkedIn Cringe Generator",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 1.0,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    throw new Error(`API Error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const result = data?.choices?.[0]?.message?.content?.trim();
  if (!result) throw new Error("Empty response");
  return result;
}

async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 1.0, maxOutputTokens: 512 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini Error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const result = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!result) throw new Error("Empty Gemini response");
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { text, length = "long" } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Please provide some text to corporate-ify." },
        { status: 400 }
      );
    }

    if (text.length > 500) {
      return NextResponse.json(
        { error: "Text is too long. Keep it under 500 characters." },
        { status: 400 }
      );
    }

    const userPrompt = `Original text: "${text.trim()}"\n\nCRITICAL LENGTH CONSTRAINT: The user requested a ${length.toUpperCase()} length response. ${
      length === "short" ? "You MUST keep it strictly to ONE short, punchy sentence. Very brief." :
      length === "medium" ? "You MUST keep it to exactly 2-3 short sentences. No more." :
      "Keep it to exactly 2 short paragraphs maximum."
    }`;

    const providers = [
      {
        name: "Groq",
        key: process.env.GROQ_API_KEY,
        call: () => callOpenAIFormat("https://api.groq.com/openai/v1/chat/completions", "llama-3.3-70b-versatile", process.env.GROQ_API_KEY!, SYSTEM_PROMPT, userPrompt)
      },
      {
        name: "OpenRouter",
        key: process.env.OPENROUTER_API_KEY,
        call: () => callOpenAIFormat("https://openrouter.ai/api/v1/chat/completions", "meta-llama/llama-3.3-70b-instruct", process.env.OPENROUTER_API_KEY!, SYSTEM_PROMPT, userPrompt)
      },
      {
        name: "Mistral",
        key: process.env.MISTRAL_API_KEY,
        call: () => callOpenAIFormat("https://api.mistral.ai/v1/chat/completions", "mistral-large-latest", process.env.MISTRAL_API_KEY!, SYSTEM_PROMPT, userPrompt)
      },
      {
        name: "Gemini",
        key: process.env.GEMINI_API_KEY,
        call: () => callGemini(process.env.GEMINI_API_KEY!, SYSTEM_PROMPT, userPrompt)
      }
    ];

    let hasKeys = false;

    for (const provider of providers) {
      if (!provider.key) continue;
      hasKeys = true;
      try {
        console.log(`[AI Fallback] Attempting generation with ${provider.name}...`);
        const result = await provider.call();
        console.log(`[AI Fallback] Success with ${provider.name}!`);
        return NextResponse.json({ result });
      } catch (error) {
        console.error(`[AI Fallback] ${provider.name} failed:`, error);
        // Automatically cascade to the next provider
      }
    }

    if (!hasKeys) {
      console.error("No API keys found in environment variables.");
      return NextResponse.json(
        { error: "Server configuration error. No AI keys available." },
        { status: 500 }
      );
    }

    // If all providers failed
    return NextResponse.json(
      { error: "All AI providers are currently busy or rate-limited. Try again in a moment! ☕" },
      { status: 503 }
    );

  } catch (error) {
    console.error("Translate API error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
