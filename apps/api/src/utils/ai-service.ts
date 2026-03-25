type AiServiceMessageRole = "system" | "user" | "assistant";

export type AiServiceMessage = {
  role: AiServiceMessageRole;
  content: string;
};

export type AiServiceOutput = {
  code: string | null;
  description: string | null;
  error: string | null;
};

export type AiServiceResponse = {
  model: string;
  output: AiServiceOutput;
};

function getAiServiceBaseUrl() {
  return (process.env.AI_SERVICE_URL?.replace(/\/$/, "") ||
    "http://localhost:8001") as string;
}

function getAiServiceModel() {
  return (process.env.AI_SERVICE_MODEL || "gemini-2.5-flash") as string;
}

function getAiServiceTemperature() {
  const value = process.env.AI_SERVICE_TEMPERATURE;
  if (!value) return 0.3;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0.3;
}

function getAiServiceTimeoutMs() {
  const value = process.env.AI_SERVICE_TIMEOUT_MS;
  if (!value) return 60_000;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 60_000;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

export async function getNextConversationTurn(
  conversation: AiServiceMessage[]
): Promise<AiServiceResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getAiServiceTimeoutMs());

  try {
    const response = await fetch(
      `${getAiServiceBaseUrl()}/v1/conversation/next`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation,
          model: getAiServiceModel(),
          temperature: getAiServiceTemperature(),
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `ai-service request failed (${response.status}): ${text || response.statusText}`
      );
    }

    const json = (await response.json()) as unknown;
    if (!isObject(json) || typeof json.model !== "string" || !isObject(json.output)) {
      throw new Error("ai-service returned an invalid response shape");
    }

    const output = json.output as Record<string, unknown>;
    const parsed: AiServiceResponse = {
      model: json.model,
      output: {
        code: (typeof output.code === "string" ? output.code : null) as string | null,
        description: (typeof output.description === "string"
          ? output.description
          : null) as string | null,
        error: (typeof output.error === "string" ? output.error : null) as string | null,
      },
    };

    // Enforce the "either generation or error" expectation lightly.
    const hasGeneration = !!(parsed.output.code && parsed.output.description);
    const hasError = !!parsed.output.error;
    if (hasGeneration === hasError) {
      throw new Error("ai-service returned an invalid output payload");
    }

    return parsed;
  } finally {
    clearTimeout(timeoutId);
  }
}

