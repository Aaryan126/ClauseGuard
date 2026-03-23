import { NextRequest, NextResponse } from "next/server";
import { analyzeContract } from "@/lib/analyzer";
import { ContractType } from "@/types";

const VALID_CONTRACT_TYPES: ContractType[] = ["nda", "saas"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const contractType = formData.get("contractType") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Please upload a PDF, DOCX, or TXT file." },
        { status: 400 }
      );
    }

    if (!contractType || !VALID_CONTRACT_TYPES.includes(contractType as ContractType)) {
      return NextResponse.json(
        { error: "Please select a contract type (NDA or SaaS Agreement)." },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const report = await analyzeContract(buffer, file.name, contractType as ContractType);

    return NextResponse.json(report);
  } catch (error) {
    console.error("Analysis error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
