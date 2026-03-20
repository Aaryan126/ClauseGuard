import { parseOffice } from "officeparser";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

export async function parseDocument(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop();

  if (!ext || !["pdf", "docx", "doc", "txt"].includes(ext)) {
    throw new Error(`Unsupported file type: .${ext}. Please upload a PDF, DOCX, or TXT file.`);
  }

  if (ext === "txt") {
    return buffer.toString("utf-8");
  }

  let text: string;

  if (ext === "pdf") {
    const result = await pdfParse(buffer);
    text = result.text;
  } else {
    const ast = await parseOffice(buffer, {
      outputErrorToConsole: false,
    });
    text = ast.toText();
  }

  if (!text || text.trim().length === 0) {
    throw new Error("Could not extract text from the document. The file may be image-based or corrupted.");
  }

  return text;
}
