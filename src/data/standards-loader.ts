import { StandardClause } from "@/types";
import standardsData from "./standards.json";

let cachedStandards: StandardClause[] | null = null;

export async function loadStandards(): Promise<StandardClause[]> {
  if (cachedStandards) return cachedStandards;
  cachedStandards = standardsData as StandardClause[];
  return cachedStandards;
}
