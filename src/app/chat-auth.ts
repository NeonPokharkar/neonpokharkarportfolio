export const chatAuthenticationPrompt =
  "I'm glad you're curious. Sign in with Google so I know who's joining the conversation, and we can keep exploring.";

export function createChatRequestHeaders(accessToken: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

export async function isChatAuthenticationRequired(response: Response): Promise<boolean> {
  if (response.status !== 401) {
    return false;
  }

  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return false;
  }

  return typeof body === 'object' && body !== null &&
    'code' in body && body.code === 'chat_authentication_required';
}
