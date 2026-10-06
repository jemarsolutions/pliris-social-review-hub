import { afterEach, expect, it, vi } from "vitest";
import { draftPersonalCaption } from "../src/lib/personal-captions";
import { captionGenerationFailure } from "../src/lib/caption-generation-error";

const source = {
  accountName: "John · INSTAGRAM",
  platform: "INSTAGRAM",
  title: "Unresolved decisions move downstream.",
  caption:
    "Good coordination resolves decisions before the field has to carry uncertainty.",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("runs the real Gateway and structured output path for an approved-post caption", async () => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "  test-key  ");
  vi.stubEnv("PERSONAL_CAPTION_MODEL", "openai/gpt-5.4");
  const transport = vi.fn(async (_url: unknown, init: RequestInit) => {
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer test-key");
    expect(headers.get("ai-language-model-id")).toBe("openai/gpt-5.4");
    const request = JSON.parse(String(init.body));
    expect(request.responseFormat.schema.properties.caption).toMatchObject({
      type: "string",
      maxLength: 1200,
    });
    expect(JSON.stringify(request.prompt)).toContain(source.caption);
    return Response.json({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            caption:
              "Clear decisions early help teams avoid uncertainty later. Good coordination makes that easier before work reaches the field.",
          }),
        },
      ],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 20, noCache: 20, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 30, text: 30, reasoning: 0 },
      },
      warnings: [],
    });
  });
  vi.stubGlobal("fetch", transport);
  const draft = await draftPersonalCaption(source);
  expect(draft.caption).toContain("Clear decisions early");
  expect(draft.model).toBe("openai/gpt-5.4");
  expect(draft.usage.totalTokens).toBe(50);
  expect(transport).toHaveBeenCalledTimes(1);
});

it.each([
  [401, "authentication_error", "authentication"],
  [402, "invalid_request_error", "credits"],
  [403, "forbidden", "access"],
  [404, "model_not_found", "model"],
  [429, "rate_limit_exceeded", "rate_limit"],
  [400, "invalid_request_error", "request"],
])(
  "identifies Gateway HTTP %s without exposing provider details",
  async (status, type, category) => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              type,
              message: "Private request body and secret test-key",
            },
          },
          { status },
        ),
      ),
    );
    const error = await draftPersonalCaption(source).catch(
      (error: unknown) => error,
    );
    const failure = captionGenerationFailure(error);
    expect(failure.category).toBe(category);
    // generateText replaces GatewayAuthenticationError with a plain Error
    // carrying its name, but discards the original status and cause.
    expect(failure.upstreamStatus).toBe(status === 401 ? undefined : status);
    expect(JSON.stringify(failure)).not.toMatch(/Private|test-key/);
  },
);

it("reports malformed structured output instead of guessing at configuration", async () => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        content: [{ type: "text", text: "not a caption object" }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: { inputTokens: { total: 20 }, outputTokens: { total: 30 } },
      }),
    ),
  );
  const error = await draftPersonalCaption(source).catch(
    (error: unknown) => error,
  );
  expect(captionGenerationFailure(error).category).toBe("output");
});

it("identifies the deployed billing-verification rejection without leaking provider text", async () => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        {
          error: {
            type: "customer_verification_required",
            message:
              "AI Gateway requires a valid credit card on file to service requests. Private test-key",
          },
        },
        { status: 403 },
      ),
    ),
  );
  const error = await draftPersonalCaption(source).catch(
    (error: unknown) => error,
  );
  expect(captionGenerationFailure(error)).toMatchObject({
    category: "billing_verification",
    upstreamStatus: 403,
    providerCode: "customer_verification_required",
  });
  expect(captionGenerationFailure(error).message).toContain("Add a valid card");
  expect(JSON.stringify(captionGenerationFailure(error))).not.toMatch(
    /Private|test-key/,
  );
});
