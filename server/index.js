require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_KEY) {
  console.warn('Warning: GEMINI_API_KEY is not set. Set it in .env.');
}

app.post('/chat', async (req, res) => {
  try {
    const { message, conversation = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    // Forward to Gemini-like endpoint. Expecting GEMINI_API_KEY to be a valid bearer token.
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta2/models/gemini-2.0:generateText';

    const payload = {
      prompt: { text: message },
      temperature: 0.2,
      maxOutputTokens: 800,
    };

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GEMINI_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: errText });
    }

    const data = await r.json();

    // Adapt response shape for the app: try to read `candidates[0].output` or `output` fields
    const reply = data?.candidates?.[0]?.output || data?.output || JSON.stringify(data);

    return res.json({ reply, raw: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'internal error' });
  }
});

app.get('/', (_req, res) => res.send('mad-healthcare chat proxy')); 

app.listen(PORT, () => console.log(`Chat proxy listening on http://localhost:${PORT}`));
