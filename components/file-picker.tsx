"use client";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { ScrapeFileInfo } from "@/lib/types";

interface FilePickerProps {
  files: ScrapeFileInfo[];
  selected: string | null;
  onChange: (fileName: string) => void;
}

export function FilePicker({ files, selected, onChange }: FilePickerProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <Label className="text-sm shrink-0">Data file:</Label>
      <Select value={selected ?? files[0].fileName} onValueChange={onChange}>
        <SelectTrigger className="w-75">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {files.map((f) => (
            <SelectItem key={f.fileName} value={f.fileName}>
              {f.fileName}{" "}
              <span className="text-muted-foreground">
                ({(f.size / 1024).toFixed(0)} KB)
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
