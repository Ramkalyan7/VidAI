import { URL } from "url";

export type RenderQueuePayload = {
  project_id: string;
  code: string;
  scene?: string;
  quality?: "low" | "medium" | "high" | "4k";
  fps?: number;
};

function getUpstashRestUrl() {
  const value = process.env.UPSTASH_REDIS_REST_URL?.trim();
  if (!value) {
    throw new Error("UPSTASH_REDIS_REST_URL is not configured");
  }

  return value.replace(/\/$/, "");
}

function getUpstashRestToken() {
  const value = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!value) {
    throw new Error("UPSTASH_REDIS_REST_TOKEN is not configured");
  }

  return value;
}

function getRenderQueueName() {
  return process.env.RENDER_QUEUE_NAME?.trim() || "render:jobs";
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

export async function enqueueProjectVideoRender(payload: RenderQueuePayload) {
  const baseUrl = getUpstashRestUrl();
  const token = getUpstashRestToken();
  const queueName = getRenderQueueName();
  const jobBody = JSON.stringify({
    ...payload,
    attempt: 0,
    queued_at: new Date().toISOString(),
  });

  const response = await fetch(new URL("/", baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["LPUSH", queueName, jobBody]),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Failed to enqueue render job (${response.status}): ${text || response.statusText}`
    );
  }

  const data = (await response.json().catch(() => null)) as
    | { result?: unknown; error?: string }
    | null;

  if (!data || data.error) {
    throw new Error(data?.error || "Upstash enqueue failed");
  }

  return data.result;
}
