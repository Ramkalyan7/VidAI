import { Router } from "express";
import {
  createProject,
  chatProject,
  getProjectById,
  getProjects,
} from "../controllers/project.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/", authMiddleware, createProject);
router.get("/", authMiddleware, getProjects);
router.get("/:projectId", authMiddleware, getProjectById);
router.post("/:projectId/chat", authMiddleware, chatProject);

export default router;
