# Live brains — no forced Ollama, no silent paid Grok

## Honest policy

| Traffic | Brains (order) |
|---------|----------------|
| **User / visitor direct chat** | **Gemini → Grok** (if `XAI_API_KEY` + `LUNA_USER_GROK=1`) → free fallbacks |
| **Ambient town free speech** | **Ollama first** (spread load) → Gemini → Groq/OpenRouter — **no Grok** |
| **Coding with Grok in this IDE** | Not the same as site billing |

Visitors are **never** required to install Ollama.  
Ambient never burns paid Grok. User chat can use Grok **only if you put an xAI key** on the server.

## Render / live env (required shape)

```
LUNA_CLOUD=1
LUNA_LLM_BACKEND=free
LUNA_FREE_BRAINS=1
LUNA_FORCE_OLLAMA=0
PREFER_OLLAMA=0
LUNA_ALLOW_GROK=0
LUNA_DISABLE_GROK=1
LUNA_GROK_FALLBACK=0
```

Plus **at least one** free key (your free-tier account):

1. **Google Gemini** (recommended for funnier / chill / true energy):  
   https://aistudio.google.com/apikey → `GEMINI_API_KEY`  
   Model: `gemini-2.0-flash` · set `LUNA_PREFER_GEMINI=1`  
   **Honest limit:** free tier has rate caps (RPM/day) — not infinite — but fine for camp + you.
2. **Groq**: https://console.groq.com → `GROQ_API_KEY` (fallback)
3. **OpenRouter free models**: https://openrouter.ai → `OPENROUTER_API_KEY` + `*:free` model

If no keys: camp still talks via **offline aether templates** (no paid call).

## Check after deploy

```
GET https://telephanti.com/api/firmament/brains
```

Expect something like:

```json
{
  "policy": {
    "paid_grok": "opt-in only…",
    "live": "free cloud… Ollama not required",
    "deceptive": false
  },
  "ollama_required": false,
  "grok_allowed": false
}
```

## Do not copy home `.env` onto Render

Home may have `PREFER_OLLAMA=1`. Live must use `LUNA_CLOUD=1` + free keys (see `render.yaml`).
