import { openDB, type DBSchema } from "idb";
import type { AnalysisReport } from "@/types";

export interface HistoryEntry {
  id: string;
  fileName: string;
  fileType: string; // "pdf", "docx", "txt"
  fileBlob?: Blob;  // original file for PDF rendering
  analyzedAt: string; // ISO date
  report: AnalysisReport;
  // Comparison fields (only present for compare entries)
  isComparison?: boolean;
  fileNameB?: string;
  fileBlobB?: Blob;
  reportB?: AnalysisReport;
}

interface ClauseGuardDB extends DBSchema {
  history: {
    key: string;
    value: HistoryEntry;
    indexes: { "by-date": string };
  };
}

function getDB() {
  return openDB<ClauseGuardDB>("clauseguard", 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore("history", { keyPath: "id" });
        store.createIndex("by-date", "analyzedAt");
      }
      // v2 adds fileBlob and fileType fields — no schema migration needed
      // since IndexedDB object stores are schemaless for value fields.
    },
  });
}

export async function saveAnalysis(
  fileName: string,
  fileType: string,
  file: File,
  report: AnalysisReport
): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.put("history", {
    id,
    fileName,
    fileType,
    fileBlob: new Blob([await file.arrayBuffer()], { type: file.type }),
    analyzedAt: new Date().toISOString(),
    report,
  });
  return id;
}

export async function saveComparison(
  fileNameA: string,
  fileNameB: string,
  fileType: string,
  fileA: File,
  fileB: File,
  reportA: AnalysisReport,
  reportB: AnalysisReport
): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.put("history", {
    id,
    fileName: fileNameA,
    fileType,
    fileBlob: new Blob([await fileA.arrayBuffer()], { type: fileA.type }),
    analyzedAt: new Date().toISOString(),
    report: reportA,
    isComparison: true,
    fileNameB,
    fileBlobB: new Blob([await fileB.arrayBuffer()], { type: fileB.type }),
    reportB,
  });
  return id;
}

/** List metadata only (no file blobs) for the history panel. */
export async function listAnalyses(): Promise<Omit<HistoryEntry, "fileBlob" | "fileBlobB">[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("history", "by-date");
  return all.reverse().map(({ fileBlob: _, fileBlobB: _b, ...rest }) => rest);
}

export async function getAnalysis(
  id: string
): Promise<HistoryEntry | undefined> {
  const db = await getDB();
  return db.get("history", id);
}

export async function deleteAnalysis(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("history", id);
}
