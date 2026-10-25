import path from "node:path";

const SUPPORTED_DOCUMENT_EXTENSIONS = new Set([
  ".pdf",
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".docx",
]);

export function isSupportedDocumentType(filename: string): boolean {
  return SUPPORTED_DOCUMENT_EXTENSIONS.has(path.extname(filename).toLowerCase());
}
