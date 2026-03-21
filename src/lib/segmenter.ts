import { ExtractedClause } from "@/types";

// Patterns that indicate the START of a new clause/section
const SECTION_PATTERNS = [
  /^(\d+\.?\d*\.?\d*)\s+[A-Z]/m,           // "1. DEFINITIONS", "3.2 Payment"
  /^(Section|Article|Clause)\s+\d+/im,       // "Section 5", "Article III"
  /^[A-Z][A-Z\s]{3,}$/m,                     // "LIMITATION OF LIABILITY"
  /^[IVXLCDM]+\.\s+/im,                      // Roman numerals: "IV. Termination"
];

// Extract a clean short title from a header line
// "6. Relationships. Nothing contained in this Agreement..." → "Relationships"
// "Section 5 - Termination Rights" → "Termination Rights"
// "LIMITATION OF LIABILITY" → "LIMITATION OF LIABILITY"
function extractTitle(headerLine: string): string {
  let title = headerLine.trim();

  // Remove leading number: "6. " or "3.2 " or "12 "
  title = title.replace(/^\d+\.?\d*\.?\d*\s+/, "");

  // Remove "Section X", "Article X", "Clause X" prefix
  title = title.replace(/^(Section|Article|Clause)\s+\d+\.?\s*/i, "");

  // Remove Roman numeral prefix: "IV. "
  title = title.replace(/^[IVXLCDM]+\.\s+/i, "");

  // Take only up to the first sentence boundary (period followed by space and uppercase)
  // This separates "Relationships. Nothing contained..." → "Relationships"
  const sentenceEnd = title.match(/^([^.]+)\.\s+[A-Z]/);
  if (sentenceEnd) {
    title = sentenceEnd[1];
  }

  // Remove trailing punctuation
  title = title.replace(/[.:]\s*$/, "").trim();

  return title || "Untitled Clause";
}

interface RawSection {
  title: string;
  fullText: string; // the COMPLETE text of this clause (header line + all body lines)
  startChar: number;
  endChar: number;
}

export function segmentClauses(text: string): ExtractedClause[] {
  const lines = text.split("\n");
  const sections: RawSection[] = [];
  let currentSection: RawSection | null = null;
  let charOffset = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const isHeader = trimmed.length > 0 && SECTION_PATTERNS.some((p) => p.test(trimmed));

    if (isHeader) {
      // Close previous section
      if (currentSection) {
        currentSection.endChar = charOffset;
        currentSection.fullText = currentSection.fullText.trim();
        sections.push(currentSection);
      }
      // Start new section — include the header line IN the clause text
      currentSection = {
        title: extractTitle(trimmed),
        fullText: line + "\n",
        startChar: charOffset,
        endChar: charOffset,
      };
    } else if (currentSection) {
      currentSection.fullText += line + "\n";
    } else {
      // Text before first header — create an implicit "Preamble" section
      if (trimmed.length > 0) {
        currentSection = {
          title: "Preamble",
          fullText: line + "\n",
          startChar: charOffset,
          endChar: charOffset,
        };
      }
    }
    charOffset += line.length + 1;
  }

  // Push the last section
  if (currentSection) {
    currentSection.endChar = charOffset;
    currentSection.fullText = currentSection.fullText.trim();
    sections.push(currentSection);
  }

  // Merge fragments shorter than 50 characters with the previous section
  const merged: RawSection[] = [];
  for (const section of sections) {
    if (section.fullText.length < 50 && merged.length > 0) {
      const prev = merged[merged.length - 1];
      prev.fullText += "\n" + section.fullText;
      prev.endChar = section.endChar;
    } else {
      merged.push(section);
    }
  }

  return merged.map((section, index) => ({
    index,
    title: section.title,
    text: section.fullText,
    startChar: section.startChar,
    endChar: section.endChar,
  }));
}

export function hasEnoughStructure(clauses: ExtractedClause[]): boolean {
  return clauses.length >= 3;
}
