import { openDB, type DBSchema } from "idb";
import type { ContractType } from "@/types";

export interface SavedClause {
  id: string;
  contractType: ContractType;
  category: string;
  title: string;
  text: string;
  savedAt: string; // ISO date
}

interface ClauseLibraryDB extends DBSchema {
  "clause-library": {
    key: string;
    value: SavedClause;
    indexes: { "by-type": ContractType };
  };
}

function getDB() {
  return openDB<ClauseLibraryDB>("clauseguard-library", 1, {
    upgrade(db) {
      const store = db.createObjectStore("clause-library", { keyPath: "id" });
      store.createIndex("by-type", "contractType");
    },
  });
}

export async function saveClause(clause: Omit<SavedClause, "id" | "savedAt">): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.put("clause-library", {
    ...clause,
    id,
    savedAt: new Date().toISOString(),
  });
  return id;
}

export async function listClauses(contractType?: ContractType): Promise<SavedClause[]> {
  const db = await getDB();
  if (contractType) {
    return db.getAllFromIndex("clause-library", "by-type", contractType);
  }
  return db.getAll("clause-library");
}

export async function deleteClause(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("clause-library", id);
}
