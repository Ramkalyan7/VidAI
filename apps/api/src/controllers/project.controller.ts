import { Response } from "express";
import { prisma } from "@repo/db";
import { AuthRequest } from "../middleware/auth.middleware";
import {z } from "zod";
import { getNextConversationTurn } from "../utils/ai-service";
import { buildProjectVideoUrl, renderProjectVideo } from "../utils/worker-service";


export const createProjectSchema = z.object({
  message: z
    .string()
    .min(1, "Message is required")
    .max(1000, "Message too long"),
});

export const chatSchema = z.object({
  message: z.string().min(1, "Message is required").max(2000, "Message too long"),
});

type AssistantPayload = {
  code: string | null;
  description: string | null;
  error: string | null;
};

function hasRenderableCode(payload: AssistantPayload): payload is AssistantPayload & { code: string } {
  return typeof payload.code === "string" && payload.code.trim().length > 0 && !payload.error;
}

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    // Check auth
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate input
    const { message } = createProjectSchema.parse(req.body);

    //DB operation
    const project = await prisma.project.create({
      data: {
        userId: req.userId,
        title: message,
        videoUrl: "",
        videoStatus: "pending",
        messages: {
          create: {
            role: "user",
            content: message,
          },
        },
      },
      include: {
        messages: true,
      },
    });

    let assistantPayload: AssistantPayload;
    try {
      const aiResponse = await getNextConversationTurn(
        project.messages.map((msg) => {
          const role = (msg.role === "assistant" ? "assistant" : "user") as
            | "assistant"
            | "user";

          return { role, content: msg.content };
        })
      );
      assistantPayload = aiResponse.output;
    } catch (aiError) {
      assistantPayload = {
        code: null,
        description: null,
        error: aiError instanceof Error ? aiError.message : "ai-service request failed",
      };
    }

    await prisma.message.create({
      data: {
        projectId: project.id,
        role: "assistant",
        content: JSON.stringify(assistantPayload),
      },
    });

    if (hasRenderableCode(assistantPayload)) {
      const videoUrl = buildProjectVideoUrl(project.id);

      await prisma.project.update({
        where: { id: project.id },
        data: {
          videoStatus: "pending",
          videoUrl,
        },
      });

      await renderProjectVideo({
        project_id: project.id,
        code: assistantPayload.code,
      });

      await prisma.project.update({
        where: { id: project.id },
        data: {
          videoStatus: "finished",
          videoUrl,
        },
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        projectId: project.id,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const projects = await prisma.project.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Failed to fetch projects",
    });
  }
};

export const getProjectById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const projectId =
      typeof req.params.projectId === "string" ? req.params.projectId.trim() : "";
    if (!projectId) {
      return res.status(400).json({ error: "Project id is required" });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    return res.status(200).json({ success: true, data: project });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch project" });
  }
};

export const chatProject = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const projectId =
      typeof req.params.projectId === "string" ? req.params.projectId.trim() : "";
    if (!projectId) {
      return res.status(400).json({ error: "Project id is required" });
    }

    const { message } = chatSchema.parse(req.body);

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const userMessage = await prisma.message.create({
      data: {
        projectId: project.id,
        role: "user",
        content: message,
      },
    });

    const conversation = [...project.messages, userMessage].map((msg) => {
      const role = (msg.role === "assistant" ? "assistant" : "user") as
        | "assistant"
        | "user";

      return { role, content: msg.content };
    });

    let assistantPayload: AssistantPayload;
    try {
      const aiResponse = await getNextConversationTurn(conversation);
      assistantPayload = aiResponse.output;
    } catch (aiError) {
      assistantPayload = {
        code: null,
        description: null,
        error: aiError instanceof Error ? aiError.message : "ai-service request failed",
      };
    }

    await prisma.message.create({
      data: {
        projectId: project.id,
        role: "assistant",
        content: JSON.stringify(assistantPayload),
      },
    });

    if (hasRenderableCode(assistantPayload)) {
      const videoUrl = buildProjectVideoUrl(project.id);

      await prisma.project.update({
        where: { id: project.id },
        data: {
          videoStatus: "pending",
          videoUrl,
        },
      });

      await renderProjectVideo({
        project_id: project.id,
        code: assistantPayload.code,
      });

      await prisma.project.update({
        where: { id: project.id },
        data: {
          videoStatus: "finished",
          videoUrl,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: assistantPayload,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Chat failed" });
  }
};
