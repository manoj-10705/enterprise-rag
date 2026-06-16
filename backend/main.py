"""
Enterprise RAG Backend — FastAPI Asynchronous Engine
=====================================================
Handles document ingestion into Qdrant vector store and streams
analytical responses from Groq (Llama 3.3 70B) via Server-Sent Events.
"""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_qdrant import QdrantVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.messages import SystemMessage, HumanMessage
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

# ──────────────────────────────────────────────────────────
# Environment Configuration
# ──────────────────────────────────────────────────────────

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", None)
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "compliance_documents")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# Embedding model dimension (all-MiniLM-L6-v2 produces 384-dim vectors)
EMBEDDING_DIM = 384

# ──────────────────────────────────────────────────────────
# Global State (initialized in lifespan)
# ──────────────────────────────────────────────────────────

embeddings: HuggingFaceEndpointEmbeddings = None  # type: ignore
qdrant_client: QdrantClient = None  # type: ignore
vector_store: QdrantVectorStore = None  # type: ignore


# ──────────────────────────────────────────────────────────
# Application Lifespan (startup / shutdown)
# ──────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize heavy resources once at startup, clean up on shutdown."""
    global embeddings, qdrant_client, vector_store

    # Startup Diagnostics
    hf_token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACEHUB_API_TOKEN")
    logger.info("--- Enterprise RAG Startup Diagnostics ---")
    logger.info(f"GROQ_API_KEY: {'Configured' if GROQ_API_KEY else 'MISSING'}")
    logger.info(f"QDRANT_URL: {QDRANT_URL}")
    logger.info(f"QDRANT_API_KEY: {'Configured' if QDRANT_API_KEY else 'MISSING'}")
    logger.info(f"HF_TOKEN: {'Configured' if hf_token else 'MISSING'}")
    logger.info(f"ALLOWED_ORIGINS: {ALLOWED_ORIGINS}")
    logger.info("------------------------------------------")

    # 1. Load embedding model
    logger.info("Loading embedding model: all-MiniLM-L6-v2 via Hugging Face Inference API ...")
    embeddings = HuggingFaceEndpointEmbeddings(
        model="sentence-transformers/all-MiniLM-L6-v2",
        task="feature-extraction",
        huggingfacehub_api_token=hf_token,
    )
    logger.success("Embedding model client initialized.")

    # 2. Connect to Qdrant
    logger.info(f"Connecting to Qdrant at {QDRANT_URL} ...")
    qdrant_client = QdrantClient(
        url=QDRANT_URL,
        api_key=QDRANT_API_KEY if QDRANT_API_KEY else None,
    )

    # 3. Ensure collection exists (create if missing)
    collections = [c.name for c in qdrant_client.get_collections().collections]
    if COLLECTION_NAME not in collections:
        logger.info(f"Creating Qdrant collection: {COLLECTION_NAME} ...")
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=EMBEDDING_DIM,
                distance=Distance.COSINE,
            ),
        )
        logger.success(f"Collection '{COLLECTION_NAME}' created.")
    else:
        logger.info(f"Collection '{COLLECTION_NAME}' already exists.")

    # 4. Initialize vector store wrapper
    vector_store = QdrantVectorStore(
        client=qdrant_client,
        collection_name=COLLECTION_NAME,
        embedding=embeddings,
    )
    logger.success("Vector store initialized. Server ready.")

    yield  # ── Server is running ──

    # Shutdown
    logger.info("Shutting down — closing Qdrant connection.")
    qdrant_client.close()


# ──────────────────────────────────────────────────────────
# FastAPI Application
# ──────────────────────────────────────────────────────────

app = FastAPI(
    title="Enterprise RAG Compliance Auditor API",
    description="Document ingestion + AI-powered compliance auditing with Groq & Qdrant",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allows frontend to communicate with the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────
# Request / Response Models
# ──────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    prompt: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The audit query or compliance question to analyze.",
    )


class IngestResponse(BaseModel):
    status: str
    message: str
    chunks: int


class HealthResponse(BaseModel):
    status: str
    qdrant_connected: bool
    collection: str
    vector_count: int


# ──────────────────────────────────────────────────────────
# LLM Factory
# ──────────────────────────────────────────────────────────

def get_llm() -> ChatGroq:
    """Creates a ChatGroq instance with Llama 3.3 70B."""
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is not set. Please configure it in .env",
        )
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=GROQ_API_KEY,
        temperature=0,
        max_tokens=1024,
    )


# ──────────────────────────────────────────────────────────
# API Endpoints
# ──────────────────────────────────────────────────────────

@app.get("/api/v1/health", response_model=HealthResponse)
async def health_check():
    """Returns server health and Qdrant connection status."""
    try:
        info = qdrant_client.get_collection(COLLECTION_NAME)
        return HealthResponse(
            status="healthy",
            qdrant_connected=True,
            collection=COLLECTION_NAME,
            vector_count=info.points_count or 0,
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="degraded",
            qdrant_connected=False,
            collection=COLLECTION_NAME,
            vector_count=0,
        )


@app.post("/api/v1/ingest", response_model=IngestResponse)
async def ingest_document(file: UploadFile = File(...)):
    """
    Parses an uploaded document, splits it into chunks,
    generates embeddings, and stores vectors in Qdrant.
    Supports .txt files.
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    allowed_extensions = (".txt",)
    if not file.filename.lower().endswith(allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}",
        )

    try:
        # Read file content
        raw_bytes = await file.read()
        content = raw_bytes.decode("utf-8")

        if not content.strip():
            raise HTTPException(status_code=400, detail="File is empty.")

        logger.info(f"Ingesting document: {file.filename} ({len(content)} chars)")

        # Split into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=600,
            chunk_overlap=60,
            length_function=len,
        )
        chunks = text_splitter.split_text(content)

        if not chunks:
            raise HTTPException(status_code=400, detail="No text chunks generated from file.")

        # Add to vector store (safe — does NOT recreate collection)
        vector_store.add_texts(
            texts=chunks,
            metadatas=[{"source": file.filename, "chunk_index": i} for i, _ in enumerate(chunks)],
        )

        logger.success(f"Indexed {len(chunks)} chunks from {file.filename}")

        return IngestResponse(
            status="success",
            message=f"Successfully chunked and indexed {len(chunks)} segments from '{file.filename}'.",
            chunks=len(chunks),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@app.post("/api/v1/audit")
async def audit_stream(request: QueryRequest):
    """
    Performs vector similarity search on ingested documents,
    then streams an AI-generated compliance audit response
    via Server-Sent Events (SSE).
    """
    try:
        # Check if collection has any vectors
        info = qdrant_client.get_collection(COLLECTION_NAME)
        if info.points_count == 0:
            raise HTTPException(
                status_code=400,
                detail="No documents have been ingested yet. Please upload documents first.",
            )

        # Retrieve relevant document chunks
        docs = vector_store.similarity_search(request.prompt, k=4)

        if not docs:
            raise HTTPException(
                status_code=404,
                detail="No relevant document context found for your query.",
            )

        # Build context from retrieved chunks
        context = "\n---\n".join([doc.page_content for doc in docs])

        logger.info(f"Audit query: '{request.prompt[:80]}...' | Context chunks: {len(docs)}")

        # Construct messages for the LLM
        messages = [
            SystemMessage(content=(
                "You are an expert compliance auditor. Analyze the provided document context "
                "and deliver a thorough, structured audit response. Use bullet points, "
                "highlight risks, and cite specific passages from the context when relevant.\n\n"
                f"## Retrieved Document Context\n\n{context}"
            )),
            HumanMessage(content=request.prompt),
        ]

        llm = get_llm()

        # SSE generator — yields tokens as they arrive from Groq
        async def event_generator():
            try:
                async for chunk in llm.astream(messages):
                    if chunk.content:
                        yield {"data": chunk.content}
            except Exception as e:
                logger.error(f"Streaming error: {e}")
                yield {"data": f"\n\n[Error: {str(e)}]"}

        return EventSourceResponse(event_generator())

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Audit failed: {e}")
        raise HTTPException(status_code=500, detail=f"Audit failed: {str(e)}")


# ──────────────────────────────────────────────────────────
# Entry Point (for direct execution)
# ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
