import { vi } from "vitest";

type Result = { status?: number; body?: unknown };
type Handler = Result | ((body: unknown) => Result | Promise<Result>);

/**
 * Mocks fetch with handlers keyed by "METHOD /path". The handlers object can
 * be changed between steps of a test; unexpected requests fail loudly.
 */
export function mockApi(handlers: Record<string, Handler>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const key = `${init?.method ?? "GET"} ${input}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    const requestBody = init?.body ? JSON.parse(init.body as string) : undefined;
    const { status = 200, body } = typeof handler === "function" ? await handler(requestBody) : handler;
    return { ok: status < 400, status, json: async () => body } as Response;
  });
}
