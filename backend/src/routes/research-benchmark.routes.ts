import { Router } from "express";
import {
  exportResearchBenchmark,
  getResearchBenchmarkDetail,
  listResearchBenchmark,
  saveResearchBenchmarkReview,
} from "../controllers/research-benchmark.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);
router.get("/", listResearchBenchmark);
router.get("/export", exportResearchBenchmark);
router.get("/:recordId", getResearchBenchmarkDetail);
router.put("/:recordId/review", saveResearchBenchmarkReview);

export default router;
