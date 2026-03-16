# Vertical Agent

A **vertical AI agent** that analyzes websites, extracts structured contact and business data, and produces actionable summaries. Built for commercial research, lead enrichment, and automated intelligence gathering—with a REST API, tool-calling (search, scrape, maps), hallucination checks, and optional vector memory.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org/)
[![Ollama](https://img.shields.io/badge/Ollama-Local%20LLM-000000)](https://ollama.ai/)

---

## Features

| Feature | Description |
|--------|-------------|
| **Website analysis** | Scrape pages, extract JSON (contacts, company info, summaries) via local LLM (Ollama). |
| **ReAct agent** | Multi-step reasoning: chooses when to **search** (Serper), **scrape** (Playwright), or **verify** (Google Maps). |
| **Critic / audit** | Second LLM pass compares extracted data to raw text to reduce hallucinations. |
| **Knowledge base** | Inject case studies and strategy notes (`dataempire.json`, `notes.md`) into prompts for context-aware answers. |
| **Vector memory** | Optional ChromaDB + Ollama embeddings for semantic lead storage and retrieval. |
| **API** | Authenticated `POST /api/v1/analyze` with API-key auth and per-project usage tracking. |
| **Key management** | CLI to issue and validate API keys (`api_keys.json`). |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Clients (x-api-key)                                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Express API (server.ts)                                          │
│  • POST /api/v1/analyze  →  Knowledge base + Ollama → response    │
└─────────────────────────────────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌──────────────┐   ┌─────────────────┐   ┌──────────────────────┐
│ agent.ts     │   │ engine.ts       │   │ vectorStore.ts        │
│ ReAct loop   │   │ Scrape → Extract│   │ ChromaDB + embeddings │
│ (search,     │   │ → Critic → Save │   │ for leads             │
│  scrape,     │   │ to dataempire   │   │                       │
│  maps)       │   │                 │   │                       │
└──────────────┘   └─────────────────┘   └──────────────────────┘
```

---

## Prerequisites

- **Node.js** 18+
- **Ollama** installed and running ([ollama.ai](https://ollama.ai)) with a model (e.g. `llama3.2:3b`)
- Optional: **Serper** API key (search), **Google Maps** API key (place verification)

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/bariseryuz/vertical-agent.git
cd vertical-agent
npm install
```

### 2. Environment

Copy the example env and set your keys (do not commit `.env`):

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required: Ollama model name
SHIIMAN_MODEL=llama3.2:3b

# Optional: API port
PORT=3000

# Optional: for search + maps tools
SERPER_API_KEY=your_serper_key
GOOGLE_MAPS_KEY=your_google_maps_key
```

### 3. Run the API server

```bash
npm run dev
# or: npx tsx src/server.ts
```

Server runs at `http://localhost:3000`. You’ll see:

```
🛡️  SHIIMAN UNIVERSAL AGENT ONLINE
📡 Port: 3000
🧠 Model: llama3.2:3b
```

### 4. Issue an API key (optional, for `/api/v1/analyze`)

```bash
npx tsx src/admin.ts "My_Project_Name"
```

This appends a new key to `api_keys.json`. Use the returned key in the `x-api-key` or `x-shiiman-token` header.

---

## API Usage

**Endpoint:** `POST /api/v1/analyze`  
**Headers:** `Content-Type: application/json`, `x-api-key: <your-key>` (or `x-shiiman-token`)

**Body:**

```json
{
  "task": "Summarize and score this lead",
  "leadData": {
    "url": "https://example.com",
    "Business Name": "Acme Corp",
    "Services": "Consulting"
  }
}
```

**Response:**

```json
{
  "success": true,
  "project": "My_Project_Name",
  "model": "llama3.2:3b",
  "result": "Summary and recommendation based on knowledge base and lead data..."
}
```

The server injects `dataempire.json` and `notes.md` (if present) into the prompt so answers can reference past case studies and strategy.

---

## Project Structure

```
vertical-agent/
├── src/
│   ├── server.ts       # Express API + auth + knowledge base
│   ├── agent.ts        # ReAct agent (search, scrape, maps)
│   ├── engine.ts       # Scrape → extract → critic → save pipeline
│   ├── vectorStore.ts  # ChromaDB + Ollama embeddings for leads
│   ├── keyManager.ts   # API key generation and validation
│   ├── admin.ts        # CLI to issue new keys
│   └── lib/
│       ├── tools.ts    # Search + Maps helpers
│       └── critics.ts  # Hallucination audit (compare JSON vs raw text)
├── .env.example        # Template (no secrets)
├── package.json
├── tsconfig.json
└── README.md
```

**Not committed (see .gitignore):** `.env`, `api_keys.json`, `dataempire.json`, `shiiman_leads.json`, `notes.md`, `node_modules/`.

---

## Scripts

| Command | Description |
|--------|-------------|
| `npx tsx src/server.ts` | Start the API server |
| `npx tsx src/admin.ts "ProjectName"` | Issue a new API key |
| `npx tsx src/engine.ts` | Run ReAct pipeline (see inline task in file) |
| `npx tsx src/agent.ts` | Run agent with tools (search/scrape/maps) |

Add to `package.json` if you prefer:

```json
"scripts": {
  "dev": "tsx src/server.ts",
  "key": "tsx src/admin.ts"
}
```

---

## Tech Stack

- **Runtime:** Node.js, TypeScript (ESM)
- **API:** Express, CORS, JSON body parsing
- **LLM:** Ollama (local models)
- **Tools:** Serper (search), Playwright + stealth (scraping), Google Places (maps)
- **Vector DB:** ChromaDB
- **Auth:** File-based API keys with usage tracking

---

## License

MIT.
