function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && !envUrl.includes("localhost")) {
      return envUrl;
    }
    const hostname = window.location.hostname || "localhost";
    return `http://${hostname}:8000`;
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}

export async function fetchApi(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  
  // Inject stored access token if available
  const headers = new Headers(options.headers || {});
  let token: string | null = null;
  if (typeof window !== "undefined") {
    token = localStorage.getItem("ai_orchestrator_access_token");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const mergedOptions: RequestInit = {
    cache: 'no-store',
    ...options,
    headers,
  };
  
  let response: Response;
  try {
    response = await fetch(url, mergedOptions);
  } catch (err: any) {
    console.warn(`[API] Failed to connect to ${url}:`, err?.message || err);
    throw new Error(`Backend connection failed at ${url}. The service may still be starting up.`);
  }

  // If 401 Unauthorized, try refreshing token once
  if (response.status === 401 && typeof window !== "undefined" && !endpoint.includes("/auth/")) {
    const refreshToken = localStorage.getItem("ai_orchestrator_refresh_token");
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem("ai_orchestrator_access_token", data.access_token);
          localStorage.setItem("ai_orchestrator_refresh_token", data.refresh_token);

          // Retry request with fresh token
          headers.set("Authorization", `Bearer ${data.access_token}`);
          response = await fetch(url, { ...mergedOptions, headers });
        } else {
          // Token expired, clear storage
          localStorage.removeItem("ai_orchestrator_access_token");
          localStorage.removeItem("ai_orchestrator_refresh_token");
          localStorage.removeItem("ai_orchestrator_user");
        }
      } catch {
        // Ignore refresh errors
      }
    } else {
      localStorage.removeItem("ai_orchestrator_access_token");
      localStorage.removeItem("ai_orchestrator_user");
    }
  }

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.clone().json();
      if (errJson.detail) errorDetail = errJson.detail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail || `API request failed: ${response.status}`);
  }
  return response;
}

export async function fetchJson<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetchApi(endpoint, options);
  return res.json();
}

