// Client for the FastAPI backend. The frontend is served by the same server,
// so requests use relative /api paths and the session cookie is sent automatically.

import type { DocumentData } from "./documents";

export type User = { id: number; name: string; email: string };

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatResponse = { documentId: number; reply: string; document: DocumentData; complete: boolean };

export type DocumentSummary = {
  id: number;
  title: string;
  companies: string[];
  complete: boolean;
  updatedAt: string; // ISO timestamp, UTC
};

export type SavedDocument = DocumentSummary & { document: DocumentData; messages: ChatMessage[] };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const GENERIC_ERROR = "Something went wrong. Please try again.";

let onUnauthorized: () => void = () => {};

/** Called when a signed-in request is rejected because the session has ended (e.g. expired or signed out elsewhere). */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

/** Sends a JSON request; errors carry the backend's message when it gives a readable one. */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // A 401 from the auth routes is an expected answer (signed out, wrong password), not an expired session.
  if (response.status === 401 && !path.startsWith("/api/auth/")) onUnauthorized();
  if (!response.ok) {
    const detail = await response.json().then((data) => data?.detail, () => undefined);
    throw new ApiError(typeof detail === "string" ? detail : GENERIC_ERROR, response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export function signUp(name: string, email: string, password: string): Promise<User> {
  return request<User>("POST", "/api/auth/signup", { name, email, password });
}

export function signIn(email: string, password: string): Promise<User> {
  return request<User>("POST", "/api/auth/signin", { email, password });
}

export function signOut(): Promise<void> {
  return request<void>("POST", "/api/auth/signout");
}

/** The signed-in user, or null when there is no valid session. */
export async function getCurrentUser(): Promise<User | null> {
  try {
    return await request<User>("GET", "/api/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function listDocuments(): Promise<DocumentSummary[]> {
  return request<DocumentSummary[]>("GET", "/api/documents");
}

export function getDocument(id: number): Promise<SavedDocument> {
  return request<SavedDocument>("GET", `/api/documents/${id}`);
}

export function deleteDocument(id: number): Promise<void> {
  return request<void>("DELETE", `/api/documents/${id}`);
}

/** Sends one message; the backend keeps the conversation and saves the document. */
export function sendChat(documentId: number | null, message: string): Promise<ChatResponse> {
  return request<ChatResponse>("POST", "/api/chat", { documentId, message });
}
