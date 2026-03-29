import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@repo/db";
import { buildProjectVideoUrl } from "../utils/render-queue";

const workerCallbackSchema = z.object({
  projectId: z.string().min(1, "Project id is required"),
  status: z.enum(["finished", "failed"]),
  error: z.string().optional(),
});

function hasValidWorkerToken(headerValue: string | undefined) {
  const expectedToken = process.env.WORKER_CALLBACK_TOKEN?.trim();
  if (!expectedToken) {
    return true;
  }

  return headerValue?.trim() === expectedToken;
}

export async function handleWorkerRenderStatus(req: Request, res: Response) {
  try {
    if (!hasValidWorkerToken(req.header("x-worker-token") || undefined)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { projectId, status, error } = workerCallbackSchema.parse(req.body);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        videoStatus: status,
        videoUrl: buildProjectVideoUrl(projectId),
      },
    });

    if (status === "failed" && error) {
      console.error(`Render failed for project ${projectId}: ${error}`);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }

    console.error(err);
    return res.status(500).json({ error: "Failed to update render status" });
  }
}
