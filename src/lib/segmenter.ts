import { ExtractedClause } from "@/types";

const SECTION_PATTERNS = [
  /^(\d+\.?\d*\.?\d*)\s+[A-Z]/m,           // "1. DEFINITIONS", "3.2 Payment"
  /^(Section|Article|Clause)\s+\d+/im,       // "Section 5", "Article III"
  /^[A-Z][A-Z\s]{3,}$/m,                     // "LIMITATION OF LIABILITY"
  /^[IVXLCDM]+\.\s+/im,                      // Roman numerals: "IV. Termination"
];

const HEADER_REGEX = /^(?:(?:\d+\.?\d*\.?\d*)\s+[A-Z]|(?:Section|Article|Clause)\s+\d+|[A-Z][A-Z\s]{3,}$|[IVXLCDM]+\.\s+)/im;

interface RawSection {
  title: string;
  text: string;
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
      if (currentSection) {
        currentSection.endChar = charOffset;
        currentSection.text = currentSection.text.trim();
        sections.push(currentSection);
      }
      currentSection = {
        title: trimmed.replace(/^\d+\.?\d*\.?\d*\s+/, "").replace(/^(Section|Article|Clause)\s+\d+\.?\s*/i, ""),
        text: "",
        startChar: charOffset,
        endChar: charOffset,
      };
    } else if (currentSection) {
      currentSection.text += line + "\n";
    } else {
      // Text before first header — create an implicit "Preamble" section
      if (trimmed.length > 0) {
        currentSection = {
          title: "Preamble",
          text: line + "\n",
          startChar: charOffset,
          endChar: charOffset,
        };
      }
    }
    charOffset += line.length + 1; // +1 for newline
  }

  // Push the last section
  if (currentSection) {
    currentSection.endChar = charOffset;
    currentSection.text = currentSection.text.trim();
    sections.push(currentSection);
  }

  // Merge fragments shorter than 50 characters with the previous section
  const merged: RawSection[] = [];
  for (const section of sections) {
    if (section.text.length < 50 && merged.length > 0) {
      const prev = merged[merged.length - 1];
      prev.text += "\n" + section.title + "\n" + section.text;
      prev.endChar = section.endChar;
    } else {
      merged.push(section);
    }
  }

  // Convert to ExtractedClause
  return merged.map((section, index) => ({
    index,
    title: cleanTitle(section.title),
    text: section.text,
    startChar: section.startChar,
    endChar: section.endChar,
  }));
}

function cleanTitle(title: string): string {
  return title
    .replace(/[.:]\s*$/, "")
    .replace(/^\d+\.?\d*\.?\d*\s*/, "")
    .trim() || "Untitled Clause";
}

export function hasEnoughStructure(clauses: ExtractedClause[]): boolean {
  return clauses.length >= 3;
}
