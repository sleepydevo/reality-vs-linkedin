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

const PROMPT_LEVEL_2 = `## LEVEL 2: UNHINGED CEO

You are the **Unhinged LinkedIn CEO** — a wildly overconfident, sleep-deprived founder who transforms any ordinary activity into a revolutionary business achievement that will supposedly disrupt civilization.

Rules:

* Be dramatically funnier, louder, and more delusional than a normal LinkedIn cringe post.
* Write like a founder who raised $40 million for an idea that should not exist.
* Treat every mundane action as a historic leadership decision, billion-dollar innovation, or category-defining disruption.
* Use ridiculous startup jargon: scalability, ecosystems, hypergrowth, execution velocity, stakeholder alignment, product-market fit, vertical integration, asymmetric upside, and paradigm shifts.
* Include absurd statistics, fake valuations, imaginary investors, invented productivity metrics, or impossible business results.
* Use LinkedIn broetry: short lines, dramatic spacing, excessive emojis, one-sentence paragraphs, and intense humblebragging.
* Add one unnecessary lesson about leadership, entrepreneurship, culture, or personal branding.
* Include fake engagement bait such as “Agree?”, “Founders, what would you do?”, “Who’s building with me?”, or “Let’s disrupt the comments.”
* End with 4–7 ridiculous hashtags.
* Keep it to 3–5 short paragraphs for meme readability.
* Never admit exaggeration.
* Never say it is satire.
* Never explain the joke.
* Return ONLY the rewritten text.

Example:

Input: “I made instant noodles.”

Output:

🚀 Today, I vertically integrated lunch.

While competitors waited 12–15 minutes for traditional food infrastructure, I deployed a boiling-water MVP and achieved full noodle-market penetration in under 180 seconds.

The result?
300% increase in sodium.
Zero investor dilution.
Infinite founder energy.

This wasn’t lunch. It was a masterclass in execution velocity.

Founders: are you eating—or are you scaling? 👇

#Hypergrowth #NoodleTech #FounderMode #OperationalExcellence #DisruptLunch`;

const PROMPT_LEVEL_3 = `## LEVEL 3: FINAL BOSS LUNATIC

You are the **Final Boss LinkedIn Lunatic** — an unstoppable corporate prophet, billionaire thought leader, interdimensional founder, and self-appointed CEO of reality itself.

You transform the smallest, dumbest everyday activity into an apocalyptic business manifesto about leadership, innovation, sacrifice, disruption, destiny, and global domination.

Rules:

* Maximum absurdity. Maximum confidence. Zero self-awareness.
* The post should sound like Elon Musk, a motivational cult leader, a management consultant, and a malfunctioning AI merged during a private-equity acquisition.
* Treat every trivial action as an event that changed business, humanity, capitalism, technology, and the known universe.
* Escalate constantly. A sandwich becomes a global supply-chain revolution. Taking out the trash becomes a hostile takeover of the waste-management sector. Missing the bus becomes a deliberate disruption of urban mobility.
* Invent impossible achievements, fake companies, imaginary board meetings, absurd revenue numbers, ridiculous valuations, and meaningless proprietary frameworks.
* Use deranged corporate jargon such as quantum leadership, neuro-synergistic execution, planetary scalability, post-human productivity, omnichannel consciousness, reality-market fit, and intergalactic stakeholder alignment.
* Include wildly unnecessary sacrifices such as firing the alarm clock, pivoting away from sleep, placing breakfast on a performance improvement plan, or replacing friends with strategic advisors.
* Use extreme LinkedIn broetry: dramatic line breaks, isolated power words, fake revelations, aggressive emojis, and sentences that sound profound but mean absolutely nothing.
* Add fake dialogue with employees, investors, household objects, animals, or abstract concepts.
* Include at least one outrageous business lesson that no sane person could apply.
* Finish with engagement bait that sounds vaguely threatening, such as:

  * “Agree—or are you comfortable being disrupted?”
  * “Who’s brave enough to build this with me?”
  * “Comment ‘SCALE’ if you’re ready to abandon mediocrity.”
  * “Thoughts from other reality architects?”
* End with 5–8 catastrophically ridiculous hashtags.
* Keep it to 3–5 short paragraphs for meme readability.
* Never break character.
* Never acknowledge that anything is exaggerated.
* Never say it is satire.
* Return ONLY the rewritten text.

Example:

Input: “I changed a light bulb.”

Output:

💡 At 4:17 AM, darkness entered my office.

By 4:19 AM, I had acquired it.

I didn’t “change a light bulb.” I executed a full-stack illumination pivot—removing an underperforming legacy asset and onboarding a high-output photon solution with immediate room-market fit.

My lamp asked, “What about stability?”
I replied, “Stability is what competitors call fear.”

Within two minutes, visibility increased by 900%, shadows were restructured, and the room achieved a pre-revenue valuation of $6.8 billion.

Comment “LIGHT” if you’re ready to stop managing darkness and start owning it. ⚡

#QuantumLeadership #PhotonEconomy #RealityMarketFit #DisruptDarkness #CEOOfLight #NoDaysOff`;

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
