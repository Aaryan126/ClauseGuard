import { NextRequest, NextResponse } from "next/server";
import { analyzeText } from "@/lib/analyzer";
import { ContractType } from "@/types";

const VALID_CONTRACT_TYPES: ContractType[] = ["nda", "saas"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, contractType } = body as { text?: string; contractType?: string };

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "No text provided." },
        { status: 400 }
      );
    }

    if (!contractType || !VALID_CONTRACT_TYPES.includes(contractType as ContractType)) {
      return NextResponse.json(
        { error: "Please select a contract type (NDA or SaaS Agreement)." },
        { status: 400 }
      );
    }

    const report = await analyzeText(text, contractType as ContractType);

    return NextResponse.json(report);
  } catch (error) {
    console.error("Analysis error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
