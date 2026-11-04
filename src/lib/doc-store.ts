/**
 * Authenticated document state backed by the Express API.
 *
 * The browser is deliberately not a second knowledge base: document metadata,
 * chunks, embeddings, and retrieval all come from the backend services.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiClient } from "./api-client";

export type StoredDoc = {
  id: string;
  name: string;
  type: string;
  sizeLabel: string;
  uploadedAt: number;
  trust?: number;
  chunkCount: number;
  parsed: boolean;
  tags?: string[];
  isUserUploaded: boolean;
  status: string;
};

const STORE_EVENT = "trustrag:store";
const STORE_STORAGE_KEY = "trustrag:documents-updated";

function notifyStoreChanged() {
  window.dispatchEvent(new Event(STORE_EVENT));
  try {
    window.localStorage.setItem(STORE_STORAGE_KEY, String(Date.now()));
  } catch {
    // Same-tab refresh still works if storage is unavailable.
  }
}

function mapRemoteDocument(document: any): StoredDoc {
  const name = String(document.original_name ?? document.filename ?? "Untitled document");
  const chunkCount = Number(document.chunks_count ?? 0);
  const status = String(document.status ?? "uploaded");
  const rawSourceTrust = document.source_trust_score;
  const sourceTrust =
    rawSourceTrust === null || rawSourceTrust === undefined || rawSourceTrust === ""
      ? undefined
      : Number(rawSourceTrust);

  return {
    id: String(document._id),
    name,
    type: docType(name),
    sizeLabel: `${(Number(document.file_size ?? 0) / 1024 / 1024).toFixed(2)} MB`,
    uploadedAt: new Date(document.created_at ?? Date.now()).getTime(),
    trust:
      typeof sourceTrust === "number" &&
      Number.isFinite(sourceTrust) &&
      sourceTrust >= 0 &&
      sourceTrust <= 100
        ? sourceTrust
        : undefined,
    chunkCount,
    parsed: status === "ready" && chunkCount > 0,
    tags: Array.isArray(document.tags) ? document.tags : [],
    isUserUploaded: true,
    status,
  };
}

async function fetchDocuments(): Promise<StoredDoc[]> {
  const response = await ApiClient.getDocuments();
  return Array.isArray(response?.documents) ? response.documents.map(mapRemoteDocument) : [];
}

export function docType(name: string) {
  const ext = name.split(".").pop()?.toUpperCase() ?? "TXT";
  return ["PDF", "DOCX", "TXT", "MD", "CSV", "JSON"].includes(ext) ? ext : "TXT";
}

/** Read plain text only to provide it as an optional extraction hint to the API. */
export async function extractText(file: File): Promise<string> {
  const ext = docType(file.name);
  return ext === "PDF" || ext === "DOCX" ? "" : file.text();
}

export async function ingestFile(file: File): Promise<StoredDoc> {
  const extractedText = await extractText(file);
  const formData = new FormData();
  formData.append("file", file);
  if (extractedText) formData.append("extracted_text", extractedText);

  const response = await ApiClient.uploadDocument(formData);
  if (!response?.document?._id) {
    throw new Error("Backend did not return an indexed document");
  }

  notifyStoreChanged();
  return mapRemoteDocument(response.document);
}

export async function ingestMultipleFiles(files: File[]): Promise<StoredDoc[]> {
  if (!files.length) return [];

  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const response = await ApiClient.uploadMultipleDocuments(formData);
  if (!Array.isArray(response?.documents)) {
    throw new Error("Backend did not return indexed documents");
  }

  notifyStoreChanged();
  return response.documents.map(mapRemoteDocument);
}

export async function removeDoc(docId: string) {
  await ApiClient.deleteDocument(docId);
  notifyStoreChanged();
}

/** Subscribe to the authenticated remote document list. */
export function useKnowledgeStore() {
  const [docs, setDocs] = useState<StoredDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDocs(await fetchDocuments());
      setError(null);
    } catch (reason) {
      setDocs([]);
      setError(reason instanceof Error ? reason.message : "Unable to load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORE_STORAGE_KEY) void refresh();
    };
    window.addEventListener(STORE_EVENT, refresh);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(STORE_EVENT, refresh);
      window.removeEventListener("storage", handleStorage);
    };
  }, [refresh]);

  return { docs, chunks: [], loading, error, refresh };
}
