import { NextRequest, NextResponse } from "next/server";
import { generateNegotiationEmail } from "@/lib/negotiation-email";
import { AnalysisReport } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { report, fileName } = (await request.json()) as {
      report: AnalysisReport;
      fileName: string;
    };

    if (!report || !fileName) {
      return NextResponse.json({ error: "Missing report or fileName" }, { status: 400 });
    }

    const email = await generateNegotiationEmail(report, fileName);
    return NextResponse.json({ email });
  } catch (error) {
    console.error("Negotiation email generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate negotiation email" },
      { status: 500 }
    );
  }
}
