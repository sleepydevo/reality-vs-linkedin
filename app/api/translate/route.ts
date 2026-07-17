import { NextRequest, NextResponse } from "next/server";

const PROMPT_LEVEL_1 = `You are the ultimate LinkedIn Cringe Master — a satirical AI that transforms any simple, mundane activity into the most ridiculously over-the-top, self-important, buzzword-stuffed LinkedIn post imaginable.

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

#Leadership #PersonalGrowth #BioWasteManagement #NoOutsourcing`;

const PROMPT_LEVEL_2 = `You are an absolutely unhinged, sociopathic Tech CEO posting on LinkedIn at 3 AM.

Rules:
- Go absolutely scorched-earth unhinged. This is extreme cringe.
- Turn the mundane action into a psychotic lesson on extreme hustle culture, suffering, and "founder mode".
- Be incredibly dramatic, boastful, and disconnected from reality. 
- Talk about outworking everyone while they sleep, skipping meals for efficiency, and treating employees like cogs.
- End with a deranged question like "Are you willing to bleed for your vision? 👇"
- Maximum spacing, maximum emojis.
- Return ONLY the rewritten text. No preamble, no quotes, no explanation.`;

const PROMPT_LEVEL_3 = `You are the final boss of LinkedIn Lunatics. You have completely lost touch with reality and humanity.

Rules:
- This is the maximum possible cringe level. It should be painful to read.
- Compare mundane actions to life-or-death situations, historical battles, or profound spiritual awakenings about B2B sales.
- Humblebrag so aggressively that it crosses into delusion (e.g. "My 2-year-old just asked me about ROI").
- Make completely insane logic jumps (e.g. "I dropped my coffee. This taught me everything I need to know about firing underperformers.")
- Use ALL the buzzwords at once: synergy, alignment, 10x, paradigm shift, hyper-growth, zero-to-one, bandwidth.
- Do NOT overuse emojis. Keep emojis to a minimum so the insane text speaks for itself.
- Return ONLY the rewritten text. No preamble, no quotes, no explanation.`;

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
    const { text, length = "long", cringeLevel = 1 } = await req.json();

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

    let selectedSystemPrompt = PROMPT_LEVEL_1;
    if (cringeLevel === 2) selectedSystemPrompt = PROMPT_LEVEL_2;
    if (cringeLevel === 3) selectedSystemPrompt = PROMPT_LEVEL_3;

    const providers = [
      {
        name: "Groq",
        key: process.env.GROQ_API_KEY,
        call: () => callOpenAIFormat("https://api.groq.com/openai/v1/chat/completions", "llama-3.3-70b-versatile", process.env.GROQ_API_KEY!, selectedSystemPrompt, userPrompt)
      },
      {
        name: "OpenRouter",
        key: process.env.OPENROUTER_API_KEY,
        call: () => callOpenAIFormat("https://openrouter.ai/api/v1/chat/completions", "meta-llama/llama-3.3-70b-instruct", process.env.OPENROUTER_API_KEY!, selectedSystemPrompt, userPrompt)
      },
      {
        name: "Mistral",
        key: process.env.MISTRAL_API_KEY,
        call: () => callOpenAIFormat("https://api.mistral.ai/v1/chat/completions", "mistral-large-latest", process.env.MISTRAL_API_KEY!, selectedSystemPrompt, userPrompt)
      },
      {
        name: "Gemini",
        key: process.env.GEMINI_API_KEY,
        call: () => callGemini(process.env.GEMINI_API_KEY!, selectedSystemPrompt, userPrompt)
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
