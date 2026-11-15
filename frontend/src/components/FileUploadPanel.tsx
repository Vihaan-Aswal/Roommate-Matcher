import { useMemo, useState } from "react";

import { Button } from "./ui/button";

interface FileUploadPanelProps {
  title: string;
  description: string;
  buttonLabel: string;
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  accept?: string;
  onFileSelected?: (file: File | null) => void;
  /** Exact headers the importer requires; shown before the upload, not after a failure. */
  columns?: string[];
  step?: number;
}

export function FileUploadPanel({
  title,
  description,
  buttonLabel,
  onUpload,
  isUploading,
  accept = ".csv,text/csv",
  onFileSelected,
  columns,
  step = 1,
}: FileUploadPanelProps): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const canSubmit = useMemo(
    () => Boolean(selectedFile) && !isUploading,
    [selectedFile, isUploading],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!selectedFile || isUploading) {
      return;
    }
    try {
      await onUpload(selectedFile);
    } catch {
      // The parent renders the request error; keeping the file selected lets
      // the operator retry without re-picking it.
      return;
    }
    setSelectedFile(null);
    onFileSelected?.(null);
    formElement.reset();
  };

  return (
    <section className="desk-panel desk-stack-sm" aria-labelledby={`upload-${step}`}>
      <div className="desk-row-between">
        <h2 className="desk-section-title" id={`upload-${step}`}>
          {title}
        </h2>
        <p className="desk-section-note">Step 1 of 3 · choose</p>
      </div>
      <p className="desk-help" style={{ maxWidth: "52ch" }}>
        {description}
      </p>

      {columns ? (
        <details className="desk-disclosure">
          <summary>File contract</summary>
          <div className="desk-stack-sm" style={{ paddingBottom: 10 }}>
            <p className="desk-help">
              The importer matches these headers exactly. Extra columns are ignored; a missing header
              rejects the whole file.
            </p>
            <ul className="desk-codes">
              {columns.map((column) => (
                <li key={column}>{column}</li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}

      <form className="desk-stack-sm" onSubmit={(event) => void handleSubmit(event)}>
        <label className="desk-field">
          <span className="desk-label">CSV file</span>
          <input
            accept={accept}
            aria-label={`${title} file input`}
            className="desk-input"
            type="file"
            onChange={(event) => {
              const nextFile = event.currentTarget.files?.[0] ?? null;
              setSelectedFile(nextFile);
              onFileSelected?.(nextFile);
            }}
          />
        </label>

        <div className="desk-row" style={{ justifyContent: "flex-end" }}>
          <Button disabled={!canSubmit} type="submit">
            {isUploading ? "Reading the file…" : buttonLabel}
          </Button>
        </div>
      </form>
    </section>
  );
}
