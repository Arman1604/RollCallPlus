# RollCall+ Cloudflare API

This Worker is the first Cloudflare step for RollCall+.

It does **not** replace the Railway scraper yet. It safely sits in front of Railway:

- Expo app calls Cloudflare.
- Cloudflare handles CORS and public API routing.
- Cloudflare forwards `/login` to Railway.
- `/login` is not cached because it contains private student data.

## Setup

1. Replace `RAILWAY_BACKEND_URL` in `wrangler.toml` with your Railway backend URL.

```toml
RAILWAY_BACKEND_URL = "https://your-backend.up.railway.app"
```

2. Install dependencies.

```bash
npm install
```

3. Test locally.

```bash
npm run dev
```

4. Deploy.

```bash
npm run deploy
```

5. After deploy, set the Expo app API base URL to the Worker URL.

Example:

```json
"apiBaseUrl": "https://rollcallplus-api.your-subdomain.workers.dev"
```
