import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import DocumentModel from "../models/Document.js";
import { AIService } from "../services/ai.service.js";
import { isDbConnected } from "../config/database.js";
import StorageService from "../services/storage.service.js";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export const getDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDbConnected()) { res.status(503).json({ error: "Database is unavailable" }); return; }
    const documents = await DocumentModel.find({ user_id: req.user?._id }).sort({ created_at: -1 });
    res.json({ documents });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch documents", message: err.message });
  }
};

export const getDocumentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDbConnected()) { res.status(503).json({ error: "Database is unavailable" }); return; }
    const { id } = req.params;

    const document = await DocumentModel.findOne({ _id: id, user_id: req.user?._id });
    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    res.json({ document });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to retrieve document", message: err.message });
  }
};

export const getDocumentChunks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDbConnected()) { res.status(503).json({ error: "Database is unavailable" }); return; }
    const documentId = req.params.id as string;
    const document = await DocumentModel.findOne({ _id: documentId, user_id: req.user?._id });
    if (!document) { res.status(404).json({ error: "Document not found" }); return; }
    const result = await AIService.getDocumentChunks(documentId, req.user?._id || "");
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: "Failed to load indexed chunks", message: err.message });
  }
};

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDbConnected()) { res.status(503).json({ error: "Database is unavailable" }); return; }
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const tags: string[] = req.body.tags
      ? (typeof req.body.tags === "string" ? req.body.tags.split(",") : req.body.tags)
      : [];

    const safeFilename = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectKey = `${req.user?._id}/${randomUUID()}-${safeFilename}`;

    // Soft upload — skips B2 gracefully if not configured
    const storagePath = await StorageService.softUpload(objectKey, file.buffer, file.mimetype);

    // Temp file for AI service ingestion
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "trustrag-"));
    const tempPath = path.join(tempDir, safeFilename);
    await fs.writeFile(tempPath, file.buffer);

    const newDoc = await DocumentModel.create({
      user_id: req.user?._id,
      filename: objectKey,
      original_name: file.originalname,
      file_size: file.size,
      mime_type: file.mimetype,
      chunks_count: 0,
      status: "chunking",
      storage_path: storagePath,
      tags: tags.map((t: string) => t.trim()).filter(Boolean),
    });

    try {
      const ingestResult = await AIService.ingestDocument({
        document_id: (newDoc._id as any).toString(),
        filename: file.originalname,
        file_path: tempPath,
        mime_type: file.mimetype,
        user_id: req.user?._id || "",
        extracted_text: (req.body.extracted_text as string) || "",
      });

      const readyDocument = await DocumentModel.findByIdAndUpdate(
        newDoc._id,
        {
          status: "ready",
          chunks_count: ingestResult.chunks_count,
          $unset: { error_message: 1 },
        },
        { new: true },
      );

      res.status(201).json({
        document: readyDocument ?? newDoc,
        message: "File uploaded and indexed successfully.",
      });
    } catch (err: any) {
      await DocumentModel.findByIdAndUpdate(newDoc._id, {
        status: "failed",
        error_message: err.message,
      });
      res.status(502).json({
        error: "Document indexing failed",
        message: err.message,
        document_id: (newDoc._id as any).toString(),
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to upload document", message: err.message });
  }
};

export const uploadMultipleDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDbConnected()) { res.status(503).json({ error: "Database is unavailable" }); return; }
    const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files uploaded" });
      return;
    }

    const tags: string[] = req.body.tags
      ? (typeof req.body.tags === "string" ? req.body.tags.split(",") : req.body.tags)
      : [];

    const results = [];
    const errors = [];

    for (const file of files) {
      const safeFilename = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectKey = `${req.user?._id}/${randomUUID()}-${safeFilename}`;

      const storagePath = await StorageService.softUpload(objectKey, file.buffer, file.mimetype);
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "trustrag-"));
      const tempPath = path.join(tempDir, safeFilename);
      await fs.writeFile(tempPath, file.buffer);

      const newDoc = await DocumentModel.create({
        user_id: req.user?._id,
        filename: objectKey,
        original_name: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
        chunks_count: 0,
        status: "chunking",
        storage_path: storagePath,
        tags: tags.map((t: string) => t.trim()).filter(Boolean),
      });

      try {
        const ingestResult = await AIService.ingestDocument({
          document_id: (newDoc._id as any).toString(),
          filename: file.originalname,
          file_path: tempPath,
          mime_type: file.mimetype,
          user_id: req.user?._id || "",
        });

        const readyDocument = await DocumentModel.findByIdAndUpdate(
          newDoc._id,
          {
            status: "ready",
            chunks_count: ingestResult.chunks_count,
            $unset: { error_message: 1 },
          },
          { new: true },
        );
        results.push(readyDocument ?? newDoc);
      } catch (err: any) {
        await DocumentModel.findByIdAndUpdate(newDoc._id, {
          status: "failed",
          error_message: err.message,
        });
        errors.push({ filename: file.originalname, error: err.message });
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }

    res.status(201).json({
      documents: results,
      total_uploaded: results.length,
      errors: errors.length ? errors : undefined,
      message: `Successfully uploaded and indexed ${results.length} document(s).`,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to process batch upload", message: err.message });
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isDbConnected()) { res.status(503).json({ error: "Database is unavailable" }); return; }
    const { id } = req.params;

    const doc = await DocumentModel.findOne({ _id: id, user_id: req.user?._id });
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    // Remove vectors first. Leaving them behind would make a deleted document
    // retrievable through the user's unscoped knowledge-base query.
    await AIService.deleteDocument((doc._id as any).toString(), req.user?._id || "");
    await StorageService.softDelete(doc.storage_path);
    await DocumentModel.deleteOne({ _id: doc._id });
    res.json({ success: true, message: "Document deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete document", message: err.message });
  }
};
