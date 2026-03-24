import { Response } from "express";
import { prisma } from "@repo/db";
import { AuthRequest } from "../middleware/auth.middleware";
import {z, ZodError } from "zod";


export const createProjectSchema = z.object({
  message: z
    .string()
    .min(1, "Message is required")
    .max(1000, "Message too long"),
});

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

    return res.status(201).json({
      success: true,
      data: project,
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
      include: {
        messages: true,
      },
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