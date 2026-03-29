import { Router } from "express";
import { handleWorkerRenderStatus } from "../controllers/worker.controller";

const router = Router();

router.post("/render-status", handleWorkerRenderStatus);

export default router;
