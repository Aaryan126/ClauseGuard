import { NextRequest } from "next/server";
import { analyzeText } from "@/lib/analyzer";
import { ContractType } from "@/types";

const VALID_CONTRACT_TYPES: ContractType[] = ["nda", "saas", "consulting"];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { text, contractType } = body as { text?: string; contractType?: string };

  if (!text || text.trim().length === 0) {
    return new Response(JSON.stringify({ error: "No text provided." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!contractType || !VALID_CONTRACT_TYPES.includes(contractType as ContractType)) {
    return new Response(JSON.stringify({ error: "Please select a valid contract type." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const report = await analyzeText(
          text,
          contractType as ContractType,
          (step, detail) => {
            const event = `data: ${JSON.stringify({ type: "progress", step, detail })}\n\n`;
            controller.enqueue(encoder.encode(event));
          }
        );

        const event = `data: ${JSON.stringify({ type: "complete", report })}\n\n`;
        controller.enqueue(encoder.encode(event));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        const event = `data: ${JSON.stringify({ type: "error", error: message })}\n\n`;
        controller.enqueue(encoder.encode(event));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
