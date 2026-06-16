# 🏢 Enterprise RAG — Compliance Auditor

A production-grade, enterprise-ready **Retrieval-Augmented Generation** application for AI-powered compliance document auditing.

![Architecture](https://img.shields.io/badge/Architecture-Decoupled_SPA-blue)
![Backend](https://img.shields.io/badge/Backend-FastAPI-009688)
![Frontend](https://img.shields.io/badge/Frontend-Next.js_+_Shadcn/ui-black)
![LLM](https://img.shields.io/badge/LLM-Groq_(Llama_3.3_70B)-orange)
![VectorDB](https://img.shields.io/badge/VectorDB-Qdrant-red)

---

## Architecture

```
┌─────────────────────────────────┐     ┌──────────────────────────────────┐
│  Frontend: Next.js + Shadcn/ui  │────▶│  Backend: FastAPI                │
│  (Vercel)                       │ SSE │  LangChain + Groq + Qdrant      │
└─────────────────────────────────┘     └──────────┬───────────────────────┘
                                                   │ HTTP REST
                                        ┌──────────▼───────────────────────┐
                                        │  Vector DB: Qdrant               │
                                        │  (Docker / Qdrant Cloud)         │
                                        └──────────────────────────────────┘
```

### Key Design Decisions

- **Asynchronous SSE Streaming**: Real-time token streaming from Groq via Server-Sent Events
- **Decoupled Vector DB**: Qdrant runs as an independent service (Docker locally, Qdrant Cloud in production)
- **Separation of Concerns**: Frontend and backend are independently deployable
- **Modern LangChain**: Uses official partner packages (`langchain-groq`, `langchain-qdrant`, `langchain-huggingface`)

---

## Prerequisites

- **Python** 3.10+
- **Node.js** 18+
- **Docker** (for local Qdrant) OR a [Qdrant Cloud](https://cloud.qdrant.io) account
- **Groq API Key** (free at [console.groq.com](https://console.groq.com))

---

## Quick Start (Local Development)

### 1. Clone & Setup

```bash
git clone <your-repo-url>
cd enterprise-rag
```

### 2. Start Qdrant (Docker)

```bash
docker compose up -d
```

### 3. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux
# Edit .env and add your GROQ_API_KEY

# Start server
uvicorn main:app --reload --port 8000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Open

Navigate to [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | ✅ | — | Groq API key from [console.groq.com](https://console.groq.com) |
| `QDRANT_URL` | ❌ | `http://localhost:6333` | Qdrant server URL |
| `QDRANT_API_KEY` | ❌ | — | Qdrant Cloud API key (leave empty for local) |
| `COLLECTION_NAME` | ❌ | `compliance_documents` | Qdrant collection name |
| `ALLOWED_ORIGINS` | ❌ | `http://localhost:3000` | Comma-separated CORS origins |

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | ❌ | `http://localhost:8000` | Backend API URL |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Health check + Qdrant status |
| `POST` | `/api/v1/ingest` | Upload & vectorize a document |
| `POST` | `/api/v1/audit` | Stream an AI audit response (SSE) |

---

## Deployment

### Frontend → Vercel

1. Push to GitHub
2. Import repo at [vercel.com](https://vercel.com)
3. Set root directory: `frontend/`
4. Add env: `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com`

### Backend → Render

1. Push to GitHub
2. Create Web Service at [render.com](https://render.com)
3. Set Docker build context: `backend/`
4. Add env vars: `GROQ_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `ALLOWED_ORIGINS`

### Vector DB → Qdrant Cloud

1. Create free cluster at [cloud.qdrant.io](https://cloud.qdrant.io)
2. Copy URL + API key into backend env vars

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js, Tailwind CSS, Shadcn/ui | Interactive dashboard SPA |
| **Backend** | FastAPI, Uvicorn | Async API server |
| **LLM** | Groq (Llama 3.3 70B) via LangChain | AI-powered audit responses |
| **Embeddings** | HuggingFace (all-MiniLM-L6-v2) | Document vectorization |
| **Vector DB** | Qdrant | Persistent vector search |
| **Streaming** | SSE (sse-starlette) | Real-time token delivery |

---

## License

MIT
