# Chat proxy (Gemini) — mad-healthcare

This small Express proxy forwards chat requests from the mobile app to Google Generative Models (Gemini 2.0).

Setup

1. Copy `.env.example` to `.env` in the `server/` folder and set `GEMINI_API_KEY`.

   - For Google Generative Models you usually need a bearer token (service account access token) with proper scopes.
   - If you only have an API key, you may need to modify `index.js` to append `?key=API_KEY` instead of the `Authorization` header.

2. Install and run:

```bash
cd server
npm install
npm start
```

3. By default the server listens on port `3000`. From the app, the default proxy URL is `http://localhost:3000`.

Testing from a physical device

- Replace `CHAT_PROXY_URL` in `Screens/constants/chat.ts` with your machine LAN IP, e.g. `http://192.168.1.42:3000`.
- Ensure your phone and dev machine are on the same network and firewall allows port 3000.

Security

- Keep `GEMINI_API_KEY` out of the mobile app; store it on the proxy server only.
- Use HTTPS in production and protect the proxy with authentication (e.g., JWT, API key, or IP allowlist).

Deploy

- You can deploy `server/` to any Node-friendly host (Render, Heroku, Fly, Vercel Serverless function with minor changes).
