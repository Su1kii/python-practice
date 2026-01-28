const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function request(path, options = {}) {
  const mergedHeaders = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const resp = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: mergedHeaders
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `Request failed: ${resp.status}`);
  }

  if (resp.status === 204) {
    return null;
  }

  return resp.json();
}

export function healthCheck() {
  return request("/health");
}

export function createJob(prompt, idempotencyKey) {
  const headers = {};
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  return request("/jobs", {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt })
  });
}

export function getJob(jobId) {
  return request(`/jobs/${jobId}`);
}

export { BASE_URL };

