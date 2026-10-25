export interface FailedIngestionCleanup {
  deleteVectors: (documentId: string, userId: string) => Promise<void>;
  deleteStoredObject: (storagePath: string) => Promise<void>;
}

export async function cleanupFailedIngestion(
  documentId: string,
  userId: string,
  storagePath: string,
  cleanup: FailedIngestionCleanup,
): Promise<string[]> {
  const results = await Promise.allSettled([
    cleanup.deleteVectors(documentId, userId),
    cleanup.deleteStoredObject(storagePath),
  ]);

  return results.flatMap((result) =>
    result.status === "rejected"
      ? [result.reason instanceof Error ? result.reason.message : String(result.reason)]
      : [],
  );
}
