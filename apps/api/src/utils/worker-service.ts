type WorkerRenderPayload = {
  project_id: string;
  code: string;
  scene?: string;
  quality?: "low" | "medium" | "high" | "4k";
  fps?: number;
};

function getWorkerServiceBaseUrl() {
  return (process.env.WORKER_SERVICE_URL?.replace(/\/$/, "") ||
    "http://localhost:8002") as string;
}

function getWorkerTimeoutMs() {
  const value = process.env.WORKER_SERVICE_TIMEOUT_MS;
  if (!value) return 5 * 60_000;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 5 * 60_000;
}

function getVideoBucket() {
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET is not configured");
  }
  return bucket;
}

function getVideoRegion() {
  const region = process.env.AWS_REGION?.trim();
  if (!region) {
    throw new Error("AWS_REGION is not configured");
  }
  return region;
}

export function buildProjectVideoUrl(projectId: string) {
  const bucket = getVideoBucket();
  const region = getVideoRegion();
  const key = `videos/${projectId}.mp4`;

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function renderProjectVideo(payload: WorkerRenderPayload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getWorkerTimeoutMs());

  try {
    const response = await fetch(`${getWorkerServiceBaseUrl()}/v1/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `worker-service request failed (${response.status}): ${text || response.statusText}`
      );
    }

    await response.arrayBuffer();
  } finally {
    clearTimeout(timeoutId);
  }
}
