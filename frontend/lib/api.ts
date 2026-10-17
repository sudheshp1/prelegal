// Client for the FastAPI backend. The frontend is served by the same server,
// so requests use relative /api paths.

export type User = { id: number; name: string; email: string };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new ApiError("Something went wrong. Please try again.", response.status);
  return response.json();
}

export async function signIn(name: string, email: string): Promise<User> {
  try {
    return await postJson<User>("/api/auth/signin", { name, email });
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      throw new ApiError("Please enter your name and a valid email address.", error.status);
    }
    throw error;
  }
}
