// api/chat.js
// Secure server-side proxy for the GLS CP Session chat widget, session recap,
// and recap-of-takeaways features.
//
// Routes through Bain's Portkey gateway to an OpenAI model. The Vercel
// environment variable is still named ANTHROPIC_API_KEY (no need to rename
// it) but it now holds the Portkey key.
//
// UPDATED: now accepts an optional `system` field from the caller, so each
// of the three features on the page (chat widget, pod-discussion recap,
// full-session recap) can send its own tailored instructions, instead of
// all three being forced to share one fixed prompt. The frontend already
// carries the real GLS knowledge (the GLS_CONTEXT variable) and sends it
// as `system` on every chat-widget call, so there's nothing to paste in
// here manually anymore — this file only needs a sensible fallback for
// the rare case no system prompt is sent at all.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY; // holds the Portkey key
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing API key on server' });
  }

  try {
    const { message, history, system } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing message' });
    }

    const FALLBACK_SYSTEM_PROMPT = `You are a helpful assistant for the GLS CP Industry Session in Vienna on 28 October. Answer questions about the agenda, pre-reads, and session content helpfully and concisely.`;

    const messages = [
      { role: 'system', content: (typeof system === 'string' && system.trim()) ? system : FALLBACK_SYSTEM_PROMPT },
      ...(Array.isArray(history) ? history : []),
      { role: 'user', content: message },
    ];

    // Portkey's standard OpenAI-compatible gateway endpoint
    const response = await fetch('https://api.portkey.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-portkey-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // cost-conscious default; swap to 'gpt-4o' if you want the stronger model
        max_tokens: 650,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Portkey/OpenAI error:', response.status, errText);
      return res.status(502).json({ error: 'Upstream AI service error', detail: errText });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('api/chat error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
