"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

// ──────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

interface HealthData {
  status: string;
  qdrant_connected: boolean;
  collection: string;
  vector_count: number;
}

// ──────────────────────────────────────────────────────────
// Icons (inline SVGs to avoid extra deps)
// ──────────────────────────────────────────────────────────

function IconUpload({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function IconLoader({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`animate-spin ${className || ""}`}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconAlertCircle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

function IconDatabase({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}

function IconFile({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────

export default function Home() {
  // State
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [ingestMessage, setIngestMessage] = useState("");
  const [ingestError, setIngestError] = useState("");
  const [auditError, setAuditError] = useState("");
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const outputEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll output
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [output]);

  // Health check on mount
  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/health`);
      if (res.ok) {
        const data: HealthData = await res.json();
        setHealth(data);
      } else {
        setHealth(null);
      }
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // ── Document Ingestion ──
  const handleUpload = async () => {
    if (!file) {
      setIngestError("Please select a file first.");
      return;
    }

    setIsIngesting(true);
    setIngestMessage("");
    setIngestError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/api/v1/ingest`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setIngestError(data.detail || "Ingestion failed.");
        return;
      }

      setIngestMessage(data.message || "Ingestion complete.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Refresh health to update vector count
      fetchHealth();
    } catch (err) {
      setIngestError(
        err instanceof Error
          ? `Connection failed: ${err.message}`
          : "Failed to connect to backend."
      );
    } finally {
      setIsIngesting(false);
    }
  };

  // ── Audit Streaming ──
  const handleAudit = async () => {
    if (!prompt.trim()) {
      setAuditError("Please enter an audit query.");
      return;
    }

    setOutput("");
    setAuditError("");
    setIsAuditing(true);

    try {
      const response = await fetch(`${API_URL}/api/v1/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        setAuditError(errData?.detail || `Server error: ${response.status}`);
        setIsAuditing(false);
        return;
      }

      if (!response.body) {
        setAuditError("No response stream received.");
        setIsAuditing(false);
        return;
      }

      // Parse SSE stream properly with buffer for partial chunks
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split("\n");
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          let rawLine = line;
          if (rawLine.endsWith("\r")) {
            rawLine = rawLine.slice(0, -1);
          }
          if (rawLine.startsWith("data:")) {
            const data = rawLine.startsWith("data: ") ? rawLine.slice(6) : rawLine.slice(5);
            if (data !== "[DONE]") {
              setOutput((prev) => prev + data);
            }
          }
        }
      }

      // Process any remaining buffer
      let rawBuffer = buffer;
      if (rawBuffer.endsWith("\r")) {
        rawBuffer = rawBuffer.slice(0, -1);
      }
      if (rawBuffer.startsWith("data:")) {
        const data = rawBuffer.startsWith("data: ") ? rawBuffer.slice(6) : rawBuffer.slice(5);
        if (data !== "[DONE]") {
          setOutput((prev) => prev + data);
        }
      }
    } catch (err) {
      setAuditError(
        err instanceof Error
          ? `Connection failed: ${err.message}`
          : "Failed to connect to backend."
      );
    } finally {
      setIsAuditing(false);
    }
  };

  // Handle Enter key for audit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isAuditing) {
      handleAudit();
    }
  };

  // ──────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────

  return (
    <main className="flex flex-col min-h-screen">
      {/* ── Header ── */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white">
              <IconShield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                Enterprise RAG Auditor
              </h1>
              <p className="text-xs text-muted-foreground">
                FastAPI · Qdrant · Groq (Llama 3.3 70B)
              </p>
            </div>
          </div>

          {/* Status Badges */}
          <div className="hidden sm:flex items-center gap-2">
            {healthLoading ? (
              <Badge variant="outline" className="gap-1.5 text-xs">
                <IconLoader className="w-3 h-3" />
                Connecting…
              </Badge>
            ) : health?.qdrant_connected ? (
              <>
                <Badge variant="outline" className="gap-1.5 text-xs border-emerald-500/40 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  API Online
                </Badge>
                <Badge variant="outline" className="gap-1.5 text-xs">
                  <IconDatabase className="w-3 h-3" />
                  {health.vector_count} vectors
                </Badge>
              </>
            ) : (
              <Badge variant="outline" className="gap-1.5 text-xs border-red-500/40 text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                API Offline
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          {/* ── Left Panel: Document Ingestion ── */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-400">
                    <IconUpload className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Document Ingestion</CardTitle>
                    <CardDescription className="text-xs">
                      Upload compliance documents for vector indexing
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* File Drop Zone */}
                <div
                  className="relative border-2 border-dashed border-border/60 rounded-lg p-6 text-center 
                             hover:border-blue-500/50 hover:bg-blue-500/5 transition-all duration-200 cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    id="file-upload"
                    type="file"
                    accept=".txt"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      setIngestError("");
                      setIngestMessage("");
                    }}
                    className="hidden"
                  />
                  {file ? (
                    <div className="animate-fade-in">
                      <IconFile className="w-8 h-8 mx-auto text-blue-400 mb-2" />
                      <p className="text-sm font-medium text-foreground truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  ) : (
                    <>
                      <IconUpload className="w-8 h-8 mx-auto text-muted-foreground/60 mb-2 group-hover:text-blue-400 transition-colors" />
                      <p className="text-sm text-muted-foreground">
                        Click to select a <span className="text-foreground font-medium">.txt</span> file
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Compliance documents, policies, reports
                      </p>
                    </>
                  )}
                </div>

                <Button
                  id="ingest-button"
                  onClick={handleUpload}
                  disabled={isIngesting || !file}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 disabled:opacity-40"
                >
                  {isIngesting ? (
                    <>
                      <IconLoader className="w-4 h-4 mr-2" />
                      Processing Vectors…
                    </>
                  ) : (
                    <>
                      <IconUpload className="w-4 h-4 mr-2" />
                      Ingest Document
                    </>
                  )}
                </Button>

                {/* Status Messages */}
                {ingestMessage && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-fade-in">
                    <IconCheck className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{ingestMessage}</span>
                  </div>
                )}
                {ingestError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
                    <IconAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{ingestError}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Info Card */}
            <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground font-medium">
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Backend</span>
                  <span className={health?.qdrant_connected ? "text-emerald-400" : "text-red-400"}>
                    {healthLoading ? "Checking…" : health?.qdrant_connected ? "Connected" : "Offline"}
                  </span>
                </div>
                <Separator className="bg-border/40" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vector DB</span>
                  <span className={health?.qdrant_connected ? "text-emerald-400" : "text-red-400"}>
                    {healthLoading ? "Checking…" : health?.qdrant_connected ? "Qdrant Online" : "Disconnected"}
                  </span>
                </div>
                <Separator className="bg-border/40" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Indexed Vectors</span>
                  <span className="text-foreground font-mono">
                    {health?.vector_count ?? "—"}
                  </span>
                </div>
                <Separator className="bg-border/40" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">LLM Model</span>
                  <span className="text-foreground text-xs">Llama 3.3 70B</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Right Panel: Audit Query + Output ── */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {/* Query Input Card */}
            <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-violet-500/10 text-violet-400">
                    <IconSearch className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Compliance Audit</CardTitle>
                    <CardDescription className="text-xs">
                      Query your indexed documents with AI-powered analysis
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    id="audit-prompt"
                    type="text"
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                      setAuditError("");
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. What data retention policies are mentioned in these documents?"
                    className="flex-1 bg-background/60 border-border/60 focus-visible:ring-violet-500/40 text-sm"
                    disabled={isAuditing}
                  />
                  <Button
                    id="audit-button"
                    onClick={handleAudit}
                    disabled={isAuditing || !prompt.trim()}
                    className="bg-violet-600 hover:bg-violet-700 text-white px-6 transition-all duration-200 disabled:opacity-40 shrink-0"
                  >
                    {isAuditing ? (
                      <>
                        <IconLoader className="w-4 h-4 mr-2" />
                        Streaming…
                      </>
                    ) : (
                      <>
                        <IconShield className="w-4 h-4 mr-2" />
                        Run Audit
                      </>
                    )}
                  </Button>
                </div>
                {auditError && (
                  <div className="flex items-start gap-2 p-3 mt-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
                    <IconAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{auditError}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Streaming Output Card */}
            <Card className="flex-1 border-border/60 bg-card/80 backdrop-blur-sm flex flex-col min-h-[400px]">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-muted-foreground font-medium">
                    Audit Output
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {isAuditing && (
                      <Badge variant="outline" className="gap-1.5 text-xs border-violet-500/40 text-violet-400 animate-pulse-glow">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                        Streaming
                      </Badge>
                    )}
                    {output && !isAuditing && (
                      <Badge variant="outline" className="gap-1.5 text-xs border-emerald-500/40 text-emerald-400">
                        <IconCheck className="w-3 h-3" />
                        Complete
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 px-6 pb-6">
                  <div className="font-mono text-sm leading-relaxed whitespace-pre-wrap min-h-[300px]">
                    {output ? (
                      <div className="animate-fade-in">
                        {output}
                        {isAuditing && (
                          <span className="inline-block w-2 h-4 bg-violet-400 ml-0.5 animate-blink rounded-sm" />
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground/40">
                        <IconShield className="w-12 h-12 mb-4" />
                        <p className="text-sm font-medium">No audit results yet</p>
                        <p className="text-xs mt-1">
                          Upload a document, then run an audit query
                        </p>
                      </div>
                    )}
                    <div ref={outputEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-muted-foreground/60">
          <span>Enterprise RAG Compliance Auditor</span>
          <span>FastAPI · Qdrant · LangChain · Groq</span>
        </div>
      </footer>
    </main>
  );
}
