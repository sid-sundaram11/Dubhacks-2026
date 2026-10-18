export async function requestAnonymousSession(options: {
  supabaseUrl: string;
  anonKey: string;
  fetchImpl: typeof fetch;
}): Promise<{ userId: string; accessToken: string }> {
  const response = await options.fetchImpl(`${options.supabaseUrl.replace(/\/$/, "")}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: options.anonKey,
      authorization: `Bearer ${options.anonKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new Error("auth_unavailable");
  const payload = (await response.json()) as {
    access_token?: string;
    user?: { id?: string };
    session?: { access_token?: string };
  };
  const accessToken = payload.access_token ?? payload.session?.access_token;
  const userId = payload.user?.id;
  if (!accessToken || !userId) throw new Error("auth_unavailable");
  return { userId, accessToken };
}
