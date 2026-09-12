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

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".txt", ".md", ".markdown", ".csv", ".docx", ".doc",
]);

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

    const ext = path.extname(safeName).toLowerCase();
    const isMimeAllowed = ALLOWED_MIME_TYPES.has(file.mimetype);
    const isExtAllowed = ALLOWED_EXTENSIONS.has(ext);

    if (isMimeAllowed || isExtAllowed) {
      return cb(null, true);
    }
    cb(
      new Error(
        `File type not supported: '${file.mimetype}' / '${ext}'. ` +
        `Allowed types: PDF, TXT, MD, CSV, DOCX`,
      ),
    );
  },
});

const router = Router();

router.use(authenticate);

router.get("/", getDocuments);
router.post("/upload", upload.single("file"), uploadDocument);
router.post("/upload-batch", upload.array("files", 10), uploadMultipleDocuments);
router.get("/:id", getDocumentById);
router.get("/:id/chunks", getDocumentChunks);
router.delete("/:id", deleteDocument);

export default router;
