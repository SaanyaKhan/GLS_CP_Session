// api/chat.js
// Secure server-side proxy for the GLS CP Session chat widget, session recap,
// and recap-of-takeaways features.
//
// Routes through Bain's Portkey gateway to an OpenAI model. The Vercel
// environment variable is still named ANTHROPIC_API_KEY (no need to rename
// it) but it now holds the Portkey key.
//
// UPDATED: tries a short list of model names in order, since we don't have
// confirmed visibility into exactly which models are enabled on this
// specific Portkey account. If the first model is rejected (e.g. not
// enabled on this account), it automatically tries the next, instead of
// failing outright on a single wrong guess. Once you confirm (via the
// Portkey dashboard's Logs, or a working request) which model actually
// works, you can trim this back down to just that one model.

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

    // Try these models in order; move on to the next if one is rejected
    // (e.g. "model not found" because it isn't enabled on this account).
    const MODELS_TO_TRY = ['gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-4o'];

    const allAttempts = [];
    for (const model of MODELS_TO_TRY) {
      const response = await fetch('https://api.portkey.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-portkey-api-key': apiKey,
        },
        body: JSON.stringify({ model, max_tokens: 650, messages }),
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || '';
        return res.status(200).json({ reply, modelUsed: model });
      }

      const attemptDetail = { status: response.status, body: await response.text(), model };
      allAttempts.push(attemptDetail);
      console.error(`Portkey rejected model "${model}":`, attemptDetail.status, attemptDetail.body);
      // Try every model regardless of error type — a 403 on one model could still mean a
      // different model is permitted, since we don't yet know if this key's restriction is
      // account-wide or scoped to specific models.
    }

    return res.status(502).json({ error: 'All models rejected', attempts: allAttempts });
  } catch (err) {
    console.error('api/chat error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
