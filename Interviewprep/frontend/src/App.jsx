import { useEffect, useMemo, useRef, useState } from "react";
import { BASE_URL, createJob, getJob, healthCheck } from "./api.js";

const STATUS_COLORS = {
  queued: "status queued",
  processing: "status processing",
  completed: "status completed",
  failed: "status failed"
};

function upsertJob(list, job) {
  const index = list.findIndex((item) => item.job_id === job.job_id);
  if (index === -1) {
    return [job, ...list];
  }
  const next = [...list];
  next[index] = { ...next[index], ...job };
  return next;
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState({ status: "unknown", error: null });
  const [error, setError] = useState(null);

  const pollersRef = useRef({});

  const activeJobs = useMemo(
    () =>
      jobs.filter(
        (job) => job.status === "queued" || job.status === "processing"
      ),
    [jobs]
  );

  useEffect(() => {
    healthCheck()
      .then((data) => setHealth({ status: data.status, error: null }))
      .catch((err) =>
        setHealth({ status: "down", error: err.message || "Health check failed" })
      );
  }, []);

  useEffect(() => {
    return () => {
      Object.values(pollersRef.current).forEach((intervalId) =>
        clearInterval(intervalId)
      );
    };
  }, []);

  useEffect(() => {
    activeJobs.forEach((job) => startPolling(job.job_id));
  }, [activeJobs]);

  const startPolling = (jobId) => {
    if (pollersRef.current[jobId]) {
      return;
    }

    pollersRef.current[jobId] = setInterval(async () => {
      try {
        const updated = await getJob(jobId);
        setJobs((prev) => upsertJob(prev, updated));
        if (updated.status === "completed" || updated.status === "failed") {
          clearInterval(pollersRef.current[jobId]);
          delete pollersRef.current[jobId];
        }
      } catch (err) {
        setError(err.message || "Failed to fetch job status.");
      }
    }, 1000);
  };

  const handleCreateJob = async (event) => {
    event.preventDefault();
    if (!prompt.trim()) {
      setError("Prompt is required.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const job = await createJob(prompt.trim(), idempotencyKey.trim());
      setJobs((prev) => upsertJob(prev, job));
      setPrompt("");
      startPolling(job.job_id);
    } catch (err) {
      setError(err.message || "Failed to create job.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (jobId) => {
    try {
      const updated = await getJob(jobId);
      setJobs((prev) => upsertJob(prev, updated));
    } catch (err) {
      setError(err.message || "Failed to refresh job.");
    }
  };

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Zom Mini Frontend</h1>
          <p className="subtitle">
            React UI for the backend running at{" "}
            <strong>{BASE_URL || "the same origin (dev proxy enabled)"}</strong>
          </p>
        </div>
        <div className="health">
          <span className="label">Health</span>
          <span className={`pill ${health.status}`}>
            {health.status}
          </span>
          {health.error && <span className="muted">{health.error}</span>}
        </div>
      </header>

      <section className="card">
        <h2>Create job</h2>
        <form onSubmit={handleCreateJob} className="form">
          <label>
            Prompt
            <textarea
              rows="3"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the job request..."
            />
          </label>
          <label>
            Idempotency key (optional)
            <input
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              placeholder="e.g. user-1234-request-1"
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Submitting..." : "Create job"}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="section-header">
          <h2>Jobs</h2>
          <span className="muted">{jobs.length} total</span>
        </div>
        {error && <div className="error">{error}</div>}
        {jobs.length === 0 ? (
          <p className="muted">No jobs yet. Create one to get started.</p>
        ) : (
          <div className="job-list">
            {jobs.map((job) => (
              <div key={job.job_id} className="job-card">
                <div className="job-main">
                  <div>
                    <div className="job-id">{job.job_id}</div>
                    <div className={STATUS_COLORS[job.status] || "status"}>
                      {job.status}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleRefresh(job.job_id)}
                  >
                    Refresh
                  </button>
                </div>
                <div className="job-details">
                  <div>
                    <span className="label">Created</span>
                    <span>{new Date(job.created_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="label">Updated</span>
                    <span>{new Date(job.updated_at).toLocaleString()}</span>
                  </div>
                  {job.result && (
                    <div className="result">
                      <span className="label">Result</span>
                      <span>{job.result}</span>
                    </div>
                  )}
                  {job.error && (
                    <div className="result error-text">
                      <span className="label">Error</span>
                      <span>{job.error}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
