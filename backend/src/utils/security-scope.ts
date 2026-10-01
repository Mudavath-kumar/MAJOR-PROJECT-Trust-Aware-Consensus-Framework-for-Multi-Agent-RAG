export class DocumentScopeError extends Error {
  readonly statusCode = 403;

  constructor() {
    super("One or more selected documents are unavailable");
    this.name = "DocumentScopeError";
  }
}

export function assertRequestedDocumentIdsAreOwned(
  requestedIds: string[] | undefined,
  ownedIds: string[],
): string[] {
  const requested = [...new Set((requestedIds ?? []).map((id) => String(id).trim()).filter(Boolean))];
  if (requested.length === 0) return [];

  const owned = new Set(ownedIds.map((id) => String(id)));
  if (requested.some((id) => !owned.has(id))) {
    throw new DocumentScopeError();
  }

  return requested;
}

export function withUserScope<T extends Record<string, unknown>>(
  filter: T,
  userId: string,
): T & { user_id: string } {
  return { ...filter, user_id: userId };
}

