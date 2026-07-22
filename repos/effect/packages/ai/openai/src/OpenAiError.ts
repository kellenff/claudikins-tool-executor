/**
 * OpenAI error metadata augmentation.
 *
 * Provides OpenAI-specific metadata fields for AI error types through module augmentation, enabling
 * typed access to OpenAI error details.
 *
 * @since 4.0.0
 */

/**
 * OpenAI-specific error metadata fields.
 *
 * @since 4.0.0
 * @category Models
 */
export type OpenAiErrorMetadata = {
  /** The OpenAI error code returned by the API. */
  readonly errorCode: string | null;
  /** The OpenAI error type returned by the API. */
  readonly errorType: string | null;
  /** The unique request ID for debugging with OpenAI support. */
  readonly requestId: string | null;
};

/**
 * OpenAI-specific rate limit metadata fields.
 *
 * **Details**
 *
 * Extends base error metadata with rate limit specific information from OpenAI's rate limit
 * headers.
 *
 * @since 4.0.0
 * @category Models
 */
export type OpenAiRateLimitMetadata = OpenAiErrorMetadata & {
  /** The rate limit type (e.g. "requests", "tokens"). */
  readonly limit: string | null;
  /** Number of remaining requests in the current window. */
  readonly remaining: number | null;
  /** Time until the request rate limit resets. */
  readonly resetRequests: string | null;
  /** Time until the token rate limit resets. */
  readonly resetTokens: string | null;
};

declare module "effect/unstable/ai/AiError" {
  /**
   * OpenAI metadata attached to `RateLimitError` values.
   *
   * **Details**
   *
   * Captures OpenAI error details together with rate limit header information from responses where
   * the provider rejected the request because a limit was reached.
   *
   * @since 4.0.0
   * @category Configuration
   */
  export interface RateLimitErrorMetadata {
    /** OpenAI-specific details for the rate limit response. */
    readonly openai?: OpenAiRateLimitMetadata | null;
  }

  /**
   * OpenAI metadata attached to `QuotaExhaustedError` values.
   *
   * **Details**
   *
   * Preserves provider error details for failures caused by exhausted account, billing, or usage
   * quota.
   *
   * @since 4.0.0
   * @category Configuration
   */
  export interface QuotaExhaustedErrorMetadata {
    /** OpenAI-specific details for the quota exhaustion response. */
    readonly openai?: OpenAiErrorMetadata | null;
  }

  /**
   * OpenAI metadata attached to `AuthenticationError` values.
   *
   * **Details**
   *
   * Preserves provider error details for failed API key, authorization, or permission checks.
   *
   * @since 4.0.0
   * @category Configuration
   */
  export interface AuthenticationErrorMetadata {
    /** OpenAI-specific details for the authentication failure. */
    readonly openai?: OpenAiErrorMetadata | null;
  }

  /**
   * OpenAI metadata attached to `ContentPolicyError` values.
   *
   * **Details**
   *
   * Preserves provider error details when OpenAI rejects input or output because it violates a
   * content policy.
   *
   * @since 4.0.0
   * @category Configuration
   */
  export interface ContentPolicyErrorMetadata {
    /** OpenAI-specific details for the content policy response. */
    readonly openai?: OpenAiErrorMetadata | null;
  }

  /**
   * OpenAI metadata attached to `InvalidRequestError` values.
   *
   * **Details**
   *
   * Preserves provider error details for malformed requests, unsupported parameters, or other
   * request validation failures reported by OpenAI.
   *
   * @since 4.0.0
   * @category Configuration
   */
  export interface InvalidRequestErrorMetadata {
    /** OpenAI-specific details for the invalid request response. */
    readonly openai?: OpenAiErrorMetadata | null;
  }

  /**
   * OpenAI metadata attached to `InternalProviderError` values.
   *
   * **Details**
   *
   * Preserves provider error details for OpenAI-side failures such as transient server errors.
   *
   * @since 4.0.0
   * @category Configuration
   */
  export interface InternalProviderErrorMetadata {
    /** OpenAI-specific details for the internal provider response. */
    readonly openai?: OpenAiErrorMetadata | null;
  }

  /**
   * OpenAI metadata attached to `InvalidOutputError` values.
   *
   * **Details**
   *
   * Preserves provider error details when an OpenAI response cannot be parsed or validated as the
   * expected output.
   *
   * @since 4.0.0
   * @category Configuration
   */
  export interface InvalidOutputErrorMetadata {
    /** OpenAI-specific details for the invalid output response. */
    readonly openai?: OpenAiErrorMetadata | null;
  }

  /**
   * OpenAI metadata attached to `StructuredOutputError` values.
   *
   * **Details**
   *
   * Preserves provider error details when OpenAI returns content that does not satisfy the
   * requested structured output schema.
   *
   * @since 4.0.0
   * @category Configuration
   */
  export interface StructuredOutputErrorMetadata {
    /** OpenAI-specific details for the structured output failure. */
    readonly openai?: OpenAiErrorMetadata | null;
  }

  /**
   * OpenAI metadata attached to `UnsupportedSchemaError` values.
   *
   * **Details**
   *
   * Preserves provider error details when an unsupported schema failure is associated with an
   * OpenAI response.
   *
   * @since 4.0.0
   * @category Configuration
   */
  export interface UnsupportedSchemaErrorMetadata {
    /** OpenAI-specific details for the unsupported schema failure. */
    readonly openai?: OpenAiErrorMetadata | null;
  }

  /**
   * OpenAI metadata attached to `UnknownError` values.
   *
   * **Details**
   *
   * Preserves provider error details for OpenAI failures that do not map cleanly to a more specific
   * AI error category.
   *
   * @since 4.0.0
   * @category Configuration
   */
  export interface UnknownErrorMetadata {
    /** OpenAI-specific details for the unclassified provider failure. */
    readonly openai?: OpenAiErrorMetadata | null;
  }
}
