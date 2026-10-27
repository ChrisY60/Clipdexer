// Never include raw provider messages: authentication errors can echo API keys.
export async function providerError(
  response: Response,
  operation: string,
): Promise<Error> {
  let code: unknown;
  let type: unknown;
  try {
    const body = await response.json();
    code = body?.error?.code;
    type = body?.error?.type;
  } catch {
    /* Non-JSON upstream errors still have a useful HTTP status. */
  }
  const known: Record<string, string> = {
    credit_balance_exhausted:
      "API credit balance is exhausted. Add credits in your AI provider billing settings, then retry indexing.",
    organization_spend_limit_exceeded:
      "The organization API spending limit has been reached. Review its billing limits before retrying.",
    project_spend_limit_exceeded:
      "The project API spending limit has been reached. Review the project limits before retrying.",
    organization_usage_limit_exceeded:
      "The organization API usage limit has been reached. Request a higher limit or contact your provider.",
    insufficient_quota:
      "API quota is unavailable. Check your provider credit balance and usage limits before retrying.",
  };
  let detail =
    typeof code === "string" && Object.hasOwn(known, code)
      ? known[code]
      : undefined;
  if (!detail && type === "insufficient_quota")
    detail = known.insufficient_quota;
  if (!detail && response.status === 401)
    detail =
      "The provider rejected the API credentials. Check OPENAI_API_KEY and any TRANSCRIPTION_API_KEY override in .env.local, then restart the server.";
  if (!detail && response.status === 429) {
    const delay = Number(response.headers.get("retry-after"));
    detail = `The provider rate limit was reached. ${Number.isFinite(delay) && delay > 0 ? `Wait at least ${Math.ceil(delay)} seconds` : "Wait briefly"} before retrying.`;
  }
  if (!detail && response.status === 403)
    detail =
      "The API key does not have permission for this operation or model. Check provider permissions.";
  if (!detail && response.status === 404)
    detail =
      "The configured model or API endpoint is unavailable. Check the provider and model settings.";
  if (!detail && response.status >= 500)
    detail = "The AI provider is temporarily unavailable. Retry later.";
  return new Error(
    `${operation} failed (HTTP ${response.status}). ${detail || "Check the configured provider, model, and request settings."}`,
  );
}
