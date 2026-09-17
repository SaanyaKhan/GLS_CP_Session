// Replaces window.storage (which only exists inside Claude's own preview) with a real,
// persistent key-value store backed by Vercel KV. Same get/set/list shape, just over HTTP.
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { action, key, prefix } = req.query;

      if (action === 'get') {
        if (!key) return res.status(400).json({ error: 'key is required' });
        const value = await kv.get(key);
        if (value === null || value === undefined) return res.status(404).json({ error: 'not found' });
        return res.status(200).json({ key, value });
      }

      if (action === 'list') {
        if (!prefix) return res.status(400).json({ error: 'prefix is required' });
        const keys = await kv.keys(`${prefix}*`);
        return res.status(200).json({ keys });
      }

      return res.status(400).json({ error: 'action must be "get" or "list"' });
    }

    if (req.method === 'POST') {
      const { key, value } = req.body || {};
      if (!key) return res.status(400).json({ error: 'key is required' });
      await kv.set(key, value);
      return res.status(200).json({ key, value });
    }

    if (req.method === 'DELETE') {
      const { key } = req.query;
      if (!key) return res.status(400).json({ error: 'key is required' });
      await kv.del(key);
      return res.status(200).json({ key, deleted: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('storage API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
