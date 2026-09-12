import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getSettings);
router.put("/", updateSettings);

export default router;
