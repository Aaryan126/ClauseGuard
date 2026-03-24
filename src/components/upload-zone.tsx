"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X } from "lucide-react";

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  isAnalyzing: boolean;
  active?: boolean;
  /** If true, shows the file after selection instead of immediately triggering action */
  showSelected?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadZone({ onFileSelected, isAnalyzing, active = false, showSelected = false }: UploadZoneProps) {
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setError(null);
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext !== "pdf") {
        setError("Please upload a PDF file.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("File too large. Maximum size is 10MB.");
        return;
      }

      if (showSelected) {
        setSelectedFile(file);
        onFileSelected(file);
      } else {
        onFileSelected(file);
      }
    },
    [onFileSelected, showSelected]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    disabled: isAnalyzing,
    noClick: !!selectedFile,
    noDrag: !!selectedFile,
  });

  const handleRemove = () => {
    setSelectedFile(null);
    setError(null);
  };

  // Show selected file state
  if (selectedFile && showSelected) {
    return (
      <div className="rounded-lg border-2 border-blue-900/30 dark:border-blue-400/30 bg-blue-950/5 dark:bg-blue-900/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-900/60 dark:text-blue-400/60 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200 truncate">{selectedFile.name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{formatSize(selectedFile.size)}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); open(); }}
              className="text-[11px] font-medium text-blue-900/60 hover:text-blue-900 dark:text-blue-400/60 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              Replace
            </button>
            <button
              onClick={handleRemove}
              className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {/* Hidden dropzone for replace */}
        <div {...getRootProps()} className="hidden"><input {...getInputProps()} /></div>
      </div>
    );
  }

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
