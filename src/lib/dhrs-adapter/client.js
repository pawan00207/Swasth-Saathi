export class DhrsUnavailableError extends Error {
  constructor(message = "DHRS is unavailable") {
    super(message);
    this.name = "DhrsUnavailableError";
  }
}

/**
 * Request Swasth Saathi's same-origin DHRS proxy.
 * @param {string} path
 * @param {{method?: string, body?: unknown, timeoutMs?: number, retries?: number}} [options]
 * @returns {Promise<any>}
 */
export async function dhrsRequest(path, options = {}) {
  const { method = "GET", body, timeoutMs = 1800, retries = 1 } = options;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`/api/dhrs/${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await response.json();
      if (!response.ok) throw new DhrsUnavailableError(data?.error || "DHRS is unavailable");
      return data;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
    }
  }

  throw lastError instanceof DhrsUnavailableError
    ? lastError
    : new DhrsUnavailableError("DHRS is unavailable");
}
