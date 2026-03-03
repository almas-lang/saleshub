type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Wraps `fetch` in try/catch, extracts error messages from JSON bodies,
 * and returns a discriminated union that never throws.
 */
export async function safeFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<FetchResult<T>> {
  try {
    const res = await fetch(url, options);

    if (!res.ok) {
      try {
        const body = await res.json();
        const message =
          typeof body.error === "string"
            ? body.error
            : body.error
              ? JSON.stringify(body.error)
              : `Request failed (${res.status})`;
        return { ok: false, error: message };
      } catch {
        return { ok: false, error: `Request failed (${res.status})` };
      }
    }

    try {
      const data = (await res.json()) as T;
      return { ok: true, data };
    } catch {
      // Some endpoints return 200 with no body
      return { ok: true, data: {} as T };
    }
  } catch {
    return { ok: false, error: "Network error — check your connection" };
  }
}

/**
 * Converts a `safeFetch` result into a throwing promise,
 * suitable for use with `toast.promise`.
 */
export async function throwOnError<T>(
  result: Promise<FetchResult<T>>
): Promise<T> {
  const r = await result;
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
