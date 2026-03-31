import { useMemo, useState } from "react";

import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

interface FileUploadPanelProps {
  title: string;
  description: string;
  buttonLabel: string;
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  accept?: string;
}

export function FileUploadPanel({
  title,
  description,
  buttonLabel,
  onUpload,
  isUploading,
  accept = ".csv,text/csv",
}: FileUploadPanelProps): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const canSubmit = useMemo(
    () => Boolean(selectedFile) && !isUploading,
    [selectedFile, isUploading],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || isUploading) {
      return;
    }
    await onUpload(selectedFile);
    setSelectedFile(null);
    event.currentTarget.reset();
  };

  return (
    <Card className="border-border/80 bg-white/90">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <Input
            accept={accept}
            aria-label={`${title} file input`}
            type="file"
            onChange={(event) => {
              const nextFile = event.currentTarget.files?.[0] ?? null;
              setSelectedFile(nextFile);
            }}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {selectedFile ? `Selected: ${selectedFile.name}` : "Upload a CSV file."}
            </p>
            <Button disabled={!canSubmit} type="submit" variant="accent">
              {isUploading ? "Uploading..." : buttonLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
