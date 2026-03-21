"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  isAnalyzing: boolean;
  active?: boolean;
}

export function UploadZone({ onFileSelected, isAnalyzing, active = false }: UploadZoneProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setError(null);
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (!ext || !["pdf", "docx", "doc", "txt"].includes(ext)) {
        setError("Please upload a PDF, DOCX, or TXT file.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("File too large. Maximum size is 10MB.");
        return;
      }

      onFileSelected(file);
    },
    [onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
      "text/plain": [".txt"],
    },
    maxFiles: 1,
    disabled: isAnalyzing,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg px-6 py-8 text-center cursor-pointer transition-all
          ${isDragActive
            ? "border-blue-900 bg-blue-950/5 dark:border-blue-400 dark:bg-blue-900/10"
            : active
              ? "border-blue-900/50 hover:border-blue-900 dark:border-blue-400/50 dark:hover:border-blue-400"
              : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
          }
          ${isAnalyzing ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <Upload className={`w-5 h-5 ${active ? "text-blue-900/60 dark:text-blue-400/60" : "text-gray-400"}`} />
          <p className="text-[13px] text-gray-500">
            {isDragActive ? "Drop file here" : "Drop a file here, or click to browse"}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-[13px] text-red-600">{error}</p>
      )}
    </div>
  );
}
