# Deutschlehrer 🇩🇪

TELC-aligned German learning app with AI-powered lessons across all 4 skills.

---

## Local Development

**1. Install dependencies**
```bash
npm install
```

**2. Add your Anthropic API key**
```bash
cp .env.local.example .env.local
# then open .env.local and paste your key
```
Get a key at https://console.anthropic.com

**3. Run the dev server**
```bash
npm run dev
```
Open http://localhost:3000

---

## Deploy to Vercel (recommended — free)

**Option A: Vercel CLI**
```bash
npm install -g vercel
vercel
```
When prompted, add the environment variable `ANTHROPIC_API_KEY`.

**Option B: GitHub + Vercel dashboard**
1. Push this folder to a GitHub repo
2. Go to https://vercel.com → New Project → Import your repo
3. Under Environment Variables, add `ANTHROPIC_API_KEY`
4. Click Deploy

That's it. Vercel gives you a public URL like `https://deutschlehrer-xyz.vercel.app`.

---

## Deploy to other platforms

**Netlify**
Same as Vercel — connect repo, add env var, deploy.

**Railway / Render**
```bash
# build command
npm run build
# start command
npm start
```
Add `ANTHROPIC_API_KEY` in the platform's environment variable settings.

---

## Project structure

```
app/
  page.jsx          ← the entire app UI
  layout.jsx        ← HTML shell
  api/
    chat/
      route.js      ← API proxy (keeps your key secret)
package.json
next.config.mjs
.env.local.example
```

The proxy route (`app/api/chat/route.js`) forwards requests to Anthropic's API
with your secret key injected server-side, so it never reaches the browser.
