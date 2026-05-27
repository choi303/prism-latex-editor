import { randomUUID } from "node:crypto";

type FileRecord = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  extractionStatus: "queued" | "processing" | "ready" | "failed";
  extractedTextPreview: string;
};

const files: FileRecord[] = [];

export function listFiles() {
  return files;
}

export function enqueueFile(filename: string, mimeType: string, size: number) {
  const file: FileRecord = {
    id: randomUUID(),
    filename,
    mimeType,
    size,
    extractionStatus: "queued",
    extractedTextPreview: ""
  };

  files.unshift(file);
  return file;
}