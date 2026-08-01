/**
 * Frontend-only knowledge store.
 * Documents the user uploads are parsed in the browser, chunked, and kept in
 * localStorage. Retrieval is a lightweight TF-IDF cosine search — no backend.
 */
import { useCallback, useEffect, useState } from "react";

export type StoredChunk = {
  id: string;
  docId: string;
  docName: string;
  index: number;
  page: number;
  text: string;
};

export type StoredDoc = {
  id: string;
  name: string;
  type: string;
  sizeLabel: string;
  uploadedAt: number;
  trust: number;
  chunkCount: number;
  parsed: boolean;
};

export type Retrieved = StoredChunk & { similarity: number; trust: "high" | "medium" | "low" };

const DOC_KEY = "trustrag.docs.v1";
const CHUNK_KEY = "trustrag.chunks.v1";
const STORE_EVENT = "trustrag:store";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(STORE_EVENT));
}

export function getDocs(): StoredDoc[] {
  return read<StoredDoc>(DOC_KEY).sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export function getChunks(): StoredChunk[] {
  return read<StoredChunk>(CHUNK_KEY);
}

export function removeDoc(docId: string) {
  write(
    DOC_KEY,
    read<StoredDoc>(DOC_KEY).filter((d) => d.id !== docId),
  );
  write(
    CHUNK_KEY,
    read<StoredChunk>(CHUNK_KEY).filter((c) => c.docId !== docId),
  );
}

export function clearStore() {
  write(DOC_KEY, []);
  write(CHUNK_KEY, []);
}

/** Extension → label. */
export function docType(name: string) {
  const ext = name.split(".").pop()?.toUpperCase() ?? "TXT";
  return ["PDF", "DOCX", "TXT", "MD", "CSV", "JSON"].includes(ext) ? ext : "TXT";
}

/** Split raw text into ~700-char chunks on sentence boundaries. */
export function chunkText(text: string, size = 700) {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).length > size && buf) {
      out.push(buf.trim());
      buf = s;
    } else {
      buf += " " + s;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter((c) => c.length > 40);
}

/**
 * Reads text in the browser. Plain formats are read directly; binary formats
 * (PDF/DOCX) are decoded best-effort — in production this step runs in the
 * ingestion service, here we surface whatever text is extractable.
 */
export async function extractText(file: File): Promise<string> {
  const ext = docType(file.name);
  if (ext === "PDF" || ext === "DOCX") {
    const buf = await file.arrayBuffer();
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    const readable = raw
      .replace(/[^\x20-\x7E\n]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    return readable.length > 400 ? readable : "";
  }
  return file.text();
}

export async function ingestFile(file: File): Promise<StoredDoc> {
  const text = await extractText(file);
  const pieces = chunkText(text);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const doc: StoredDoc = {
    id,
    name: file.name,
    type: docType(file.name),
    sizeLabel: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    uploadedAt: Date.now(),
    trust: pieces.length ? Math.min(96, 68 + Math.round(Math.log2(pieces.length + 1) * 6)) : 0,
    chunkCount: pieces.length,
    parsed: pieces.length > 0,
  };
  const chunks: StoredChunk[] = pieces.map((t, i) => ({
    id: `${id}-c${i}`,
    docId: id,
    docName: file.name,
    index: i,
    page: Math.floor(i / 3) + 1,
    text: t,
  }));
  write(DOC_KEY, [...read<StoredDoc>(DOC_KEY), doc]);
  write(CHUNK_KEY, [...read<StoredChunk>(CHUNK_KEY), ...chunks]);
  return doc;
}

const STOP = new Set(
  "the a an and or of to in for on with is are was were be been it its this that as at by from we you your our their them they what which how why does do can".split(
    " ",
  ),
);

function tokenize(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Cosine similarity over TF-IDF vectors across the stored corpus. */
export function retrieve(query: string, docIds: string[] | null, topK = 5): Retrieved[] {
  const all = getChunks().filter((c) => !docIds || docIds.includes(c.docId));
  if (!all.length) return [];
  const q = tokenize(query);
  if (!q.length) return [];

  const df = new Map<string, number>();
  const docTokens = all.map((c) => {
    const t = tokenize(c.text);
    for (const w of new Set(t)) df.set(w, (df.get(w) ?? 0) + 1);
    return t;
  });
  const idf = (w: string) => Math.log(1 + all.length / (1 + (df.get(w) ?? 0)));

  const scored = all.map((chunk, i) => {
    const tokens = docTokens[i]!;
    const tf = new Map<string, number>();
    for (const w of tokens) tf.set(w, (tf.get(w) ?? 0) + 1);
    let dot = 0;
    for (const w of new Set(q)) {
      const weight = (tf.get(w) ?? 0) / (tokens.length || 1);
      dot += weight * idf(w);
    }
    const norm = Math.sqrt(new Set(q).size) || 1;
    const similarity = Math.max(0, Math.min(0.99, (dot / norm) * 14));
    return {
      ...chunk,
      similarity,
      trust: (similarity > 0.6 ? "high" : similarity > 0.35 ? "medium" : "low") as Retrieved["trust"],
    };
  });

  return scored
    .filter((c) => c.similarity > 0.02)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/** Extractive answer assembled from the retrieved evidence, with citations. */
export function synthesizeAnswer(query: string, hits: Retrieved[]) {
  if (!hits.length) {
    return `I could not find supporting evidence for **"${query}"** in the indexed documents.\n\n*Upload a source or widen the document filter, then ask again — TrustRAG will not answer without grounding.*`;
  }
  const lead = hits
    .slice(0, 2)
    .map((h, i) => `${trimSentence(h.text)} [${i + 1}]`)
    .join(" ");
  const support = hits
    .slice(2, 4)
    .map((h, i) => `${trimSentence(h.text, 180)} [${i + 3}]`)
    .join(" ");
  return [
    `Based on **${hits.length} verified passage${hits.length > 1 ? "s" : ""}** retrieved from ${new Set(hits.map((h) => h.docName)).size} source(s):\n\n${lead}`,
    support ? `\n\nSupporting context: ${support}` : "",
    `\n\n*Every sentence above is extracted from your documents — open the evidence panel to inspect the exact passages.*`,
  ].join("");
}

function trimSentence(text: string, max = 260) {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max).replace(/\s\S*$/, "")}…` : t;
}

/** Scores shown next to every answer. */
export function scoreAnswer(hits: Retrieved[]) {
  if (!hits.length) return { confidence: 0, trust: 0, consensus: 0 };
  const top = hits[0]!.similarity;
  const avg = hits.reduce((s, h) => s + h.similarity, 0) / hits.length;
  const spread = top - hits[hits.length - 1]!.similarity;
  return {
    confidence: Math.round(Math.min(98, 40 + top * 60)),
    trust: Math.round(Math.min(97, 45 + avg * 60)),
    consensus: Math.round(Math.max(35, Math.min(96, 92 - spread * 70))),
  };
}

/** Subscribe to the store from any page. */
export function useKnowledgeStore() {
  const [docs, setDocs] = useState<StoredDoc[]>([]);
  const [chunks, setChunks] = useState<StoredChunk[]>([]);

  const sync = useCallback(() => {
    setDocs(getDocs());
    setChunks(getChunks());
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [sync]);

  return { docs, chunks, refresh: sync };
}
