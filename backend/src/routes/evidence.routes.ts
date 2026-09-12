import { Router } from "express";
import {
  getEvidenceByMessageId,
  exportAuditTrail,
  listAuditRecords,
} from "../controllers/evidence.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/audit-trail", listAuditRecords);
router.get("/messages/:messageId", getEvidenceByMessageId);
router.get("/messages/:messageId/export", exportAuditTrail);

export default router;
