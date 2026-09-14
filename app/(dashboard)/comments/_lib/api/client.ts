import { encrypt } from "@/lib/mock/provider-credentials";

// ============================================
// API Client Configuration
// ============================================

const getBaseUrl = (): string => "/api/demo-comments";

// ============================================
// Error Classes
// ============================================

export class ApiError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "UNAUTHENTICATED");
    this.name = "AuthenticationError";
  }
}

export class TokenEncryptionError extends ApiError {
  constructor() {
    super("Failed to encrypt token", 400, "TOKEN_ENCRYPTION_FAILED");
    this.name = "TokenEncryptionError";
  }
}

// Hard ceiling on every comments-management request. Without it, a stalled or
// overloaded backend leaves the fetch pending indefinitely and the UI spins
// forever instead of surfacing an error the user can retry.
export const COMMENTS_API_REQUEST_TIMEOUT_MS = 12_000;

function isTimeoutOrAbort(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
}

/**
 * fetch() with an optional bounded timeout. A timeout/abort is normalized to a
 * 408 ApiError so callers (and react-query) get a typed, retryable failure
 * instead of a raw DOMException or an unresolved promise. Pass `null` to wait
 * for the server (used for slow page subscribe/unsubscribe flows).
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number | null = COMMENTS_API_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const requestInit = timeoutMs === null ? init : { ...init, signal: AbortSignal.timeout(timeoutMs) };

  try {
    return await fetch(url, requestInit);
  } catch (error) {
    if (timeoutMs !== null && isTimeoutOrAbort(error)) {
      throw new ApiError(
        `Comments are temporarily unavailable. The comments service did not respond within ${
          timeoutMs / 1000
        }s. Please retry.`,
        408,
        "REQUEST_TIMEOUT",
      );
    }
    throw error;
  }
}

// ============================================
// Request Helpers
// ============================================

/**
 * Get authorization headers with encrypted token
 */
export const getAuthHeaders = (facebookToken: string | null | undefined): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (facebookToken) {
    const encryptedToken = encrypt(facebookToken);
    if (!encryptedToken) {
      throw new TokenEncryptionError();
    }
    headers["Authorization"] = `Bearer ${encryptedToken}`;
  }

  return headers;
};

/**
 * Build URL with query parameters
 */
export const buildUrl = (endpoint: string, params?: Record<string, string | number | boolean | undefined>): string => {
  const baseUrl = getBaseUrl();
  const url = new URL(endpoint, baseUrl);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
};

/**
 * Parse API response and handle errors
 */
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    // Log full error response for debugging
    console.error(`[API Response Error] Status: ${response.status}`, JSON.stringify(errorData, null, 2));

    // Extract error message - handle both string and object error formats
    // NestJS HttpExceptions return { error: "Forbidden", message: "actual error", statusCode: 403 }
    // so prioritize errorData.message over generic errorData.error strings
    let errorMessage: string;
    if (typeof errorData.error === "object" && errorData.error?.message) {
      errorMessage = errorData.error.message;
    } else if (Array.isArray(errorData.message)) {
      // NestJS validation errors return an array of messages
      errorMessage = errorData.message.join(", ");
    } else if (errorData.message) {
      errorMessage = errorData.message;
    } else if (typeof errorData.error === "string") {
      errorMessage = errorData.error;
    } else {
      errorMessage = `Request failed: ${response.status}`;
    }

    // Extract error code
    const errorCode = errorData.error?.code || errorData.code;

    throw new ApiError(errorMessage, response.status, errorCode);
  }

  return await response.json();
};

// ============================================
// Base Request Methods
// ============================================

interface RequestOptions {
  token?: string | null;
  headers?: HeadersInit;
  /** Default 12s. Pass `null` to disable the client timeout for long-running calls. */
  timeoutMs?: number | null;
}

/**
 * Make a GET request
 */
export const get = async <T>(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>,
  options?: RequestOptions,
): Promise<T> => {
  const url = buildUrl(endpoint, params);
  const headers = options?.token
    ? getAuthHeaders(options.token)
    : { "Content-Type": "application/json", ...options?.headers };

  // Debug: Log request details
  console.log(`[API GET] ${endpoint}`, {
    url,
    hasToken: !!options?.token,
    hasAuthHeader: !!(headers as Record<string, string>)["Authorization"],
  });

  // no-store: these resources change server-side (e.g. the scheduler posts a
  // pending reply), so a manual refresh / react-query refetch must hit the
  // server every time instead of being answered from the browser HTTP cache.
  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers,
      cache: "no-store",
    },
    options?.timeoutMs,
  );

  // Debug: Log response status
  if (!response.ok) {
    const errorBody = await response.clone().text();
    console.error(`[API GET ERROR] ${endpoint} - Status: ${response.status} - Body: ${errorBody}`);
  }

  return handleResponse<T>(response);
};

/**
 * Make a POST request
 */
export const post = async <T>(
  endpoint: string,
  body?: Record<string, unknown>,
  options?: RequestOptions,
): Promise<T> => {
  const url = buildUrl(endpoint);
  const headers = options?.token
    ? getAuthHeaders(options.token)
    : { "Content-Type": "application/json", ...options?.headers };

  // Debug: Log request details
  console.log(`[API POST] ${endpoint}`, {
    url,
    hasToken: !!options?.token,
    hasAuthHeader: !!(headers as Record<string, string>)["Authorization"],
  });

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    },
    options?.timeoutMs,
  );

  return handleResponse<T>(response);
};

/**
 * Make a DELETE request
 */
export const del = async <T>(
  endpoint: string,
  body?: Record<string, unknown>,
  options?: RequestOptions,
): Promise<T> => {
  const url = buildUrl(endpoint);
  const headers = options?.token
    ? getAuthHeaders(options.token)
    : { "Content-Type": "application/json", ...options?.headers };

  const response = await fetchWithTimeout(
    url,
    {
      method: "DELETE",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    },
    options?.timeoutMs,
  );

  return handleResponse<T>(response);
};

/**
 * Make a PATCH request
 */
export const patch = async <T>(
  endpoint: string,
  body?: Record<string, unknown>,
  options?: RequestOptions,
): Promise<T> => {
  const url = buildUrl(endpoint);
  const headers = options?.token
    ? getAuthHeaders(options.token)
    : { "Content-Type": "application/json", ...options?.headers };

  const response = await fetchWithTimeout(
    url,
    {
      method: "PATCH",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    },
    options?.timeoutMs,
  );

  return handleResponse<T>(response);
};

export const put = async <T>(
  endpoint: string,
  body?: Record<string, unknown>,
  options?: RequestOptions,
): Promise<T> => {
  const url = buildUrl(endpoint);
  const headers = options?.token
    ? getAuthHeaders(options.token)
    : { "Content-Type": "application/json", ...options?.headers };

  const response = await fetchWithTimeout(
    url,
    {
      method: "PUT",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    },
    options?.timeoutMs,
  );

  return handleResponse<T>(response);
};

// Export the base client
export const apiClient = {
  get,
  post,
  delete: del,
  patch,
  put,
  getAuthHeaders,
  buildUrl,
};

export default apiClient;
