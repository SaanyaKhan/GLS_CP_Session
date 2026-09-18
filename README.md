# GLS CP Industry Session — deployment with real storage & chat

This version replaces the Claude-only `window.storage` and direct Anthropic API calls
with a real backend, so the reading checklist, notes, live discussion, closing thoughts,
session recap, and "Ask about GLS" chat all actually persist once deployed.

## What's in this folder
- `index.html` — the page itself
- `api/storage.js` — replaces window.storage, backed by Vercel KV
- `api/chat.js` — securely proxies chat/recap requests to Claude, keeping your API key server-side
- `package.json` — declares the one dependency (`@vercel/kv`)

## Deploy steps

1. **Push this folder to a GitHub repo**, then import it in Vercel
   (Vercel → Add New → Project → import the repo).
   This needs Git rather than drag-and-drop, because Vercel has to run `npm install` for the KV package.

2. **Add a Vercel KV database:**
   - In your Vercel project → Storage tab → Create Database → KV
   - Connect it to this project (Vercel does this automatically when you create it from inside the project)

3. **Add your Anthropic API key:**
   - Vercel project → Settings → Environment Variables
   - Add `ANTHROPIC_API_KEY` with your real key as the value
   - Get a key at console.anthropic.com if you don't have one yet

4. **Redeploy** after adding the environment variable (Vercel → Deployments → Redeploy),
   since environment variables only apply to deployments made after they're added.

That's it — once deployed, the page's `window.storage` calls automatically go through
`/api/storage`, and the chat/recap calls go through `/api/chat`, with your API key never
exposed in the browser.
