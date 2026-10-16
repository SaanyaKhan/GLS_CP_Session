// api/chat.js
// Secure server-side proxy for the GLS CP Session chat widget, session recap,
// and recap-of-takeaways features.
//
// UPDATED: now routes through Bain's Portkey gateway to an OpenAI model,
// instead of calling Anthropic directly. The Vercel environment variable
// is still named ANTHROPIC_API_KEY (no need to rename it) but it now holds
// your Portkey key.

export default async function handler(req, res) {
  // Allow requests from the deployed site (adjust if you lock this down further)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY; // now holds the Portkey key
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing API key on server' });
  }

  try {
    const { message, history } = req.body || {};

    // ============================================================
    // PASTE YOUR ORIGINAL SYSTEM PROMPT HERE
    // (copy the SYSTEM_PROMPT string from the OLD api/chat.js file
    // that's currently in your GitHub repo \u2014 the one with the real
    // Sage research content about the agenda, readings, etc.)
    // ============================================================
    const SYSTEM_PROMPT = `You are a helpful assistant for the GLS CP Industry Session in Vienna on 28 October. Answer questions about the agenda, pre-reads, and session content helpfully and concisely.`;
    // ============================================================

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
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
