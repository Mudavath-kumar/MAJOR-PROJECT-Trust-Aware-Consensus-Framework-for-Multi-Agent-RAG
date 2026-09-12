import { Request, Response, NextFunction } from "express";

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error("💥 Unhandled Error:", err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    error: err.name || "Error",
    message,
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
};
