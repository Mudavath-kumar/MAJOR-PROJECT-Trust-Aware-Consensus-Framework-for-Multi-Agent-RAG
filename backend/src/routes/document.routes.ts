import { Router } from "express";
import multer from "multer";
import path from "node:path";
import {
  getDocuments,
  getDocumentById,
  getDocumentChunks,
  uploadDocument,
  uploadMultipleDocuments,
  deleteDocument,
} from "../controllers/document.controller.js";
import { authenticate } from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rateLimiter.js";
import { isSupportedDocumentType } from "../utils/document-types.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max per file
    files: 10,                   // max 10 files per batch
  },
  fileFilter: (req, file, cb) => {
    // Sanitize original name to prevent path traversal
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._\-\s]/g, "_");
    file.originalname = safeName;

    if (isSupportedDocumentType(safeName)) {
      return cb(null, true);
    }
    cb(
      new Error(
        `File type not supported: '${file.mimetype}' / '${path.extname(safeName).toLowerCase()}'. ` +
        `Allowed types: PDF, TXT, MD, CSV, JSON, DOCX`,
      ),
    );
  },
});

const router = Router();

router.use(authenticate);

router.get("/", getDocuments);
router.post("/upload", uploadLimiter, upload.single("file"), uploadDocument);
router.post("/upload-batch", uploadLimiter, upload.array("files", 10), uploadMultipleDocuments);
router.get("/:id", getDocumentById);
router.get("/:id/chunks", getDocumentChunks);
router.delete("/:id", deleteDocument);

export default router;
