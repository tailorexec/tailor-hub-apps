import { useRef, useState, type DragEvent } from "react";
import { UploadCloud, FileText, X } from "lucide-react";

interface Props {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

const TailorUploadZone = ({ file, onFileChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    const name = f.name.toLowerCase();
    const ok = [".pdf", ".docx", ".txt"].some((ext) => name.endsWith(ext));
    if (!ok) return;
    onFileChange(f);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-[10px] border-[1.5px] border-border bg-secondary p-4 mt-2">
        <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {(file.size / 1024).toFixed(0)} KB
          </p>
        </div>
        <button
          onClick={() => onFileChange(null)}
          className="w-8 h-8 rounded-md hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Remover arquivo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`mt-2 cursor-pointer rounded-[10px] border-2 border-dashed p-8 text-center transition-colors ${
        dragOver
          ? "border-primary bg-secondary"
          : "border-border bg-background hover:bg-secondary"
      }`}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
          <UploadCloud className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          Clique ou arraste o arquivo aqui
        </p>
        <p className="text-xs text-muted-foreground">Arquivos .pdf, .docx ou .txt</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,text/plain"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
};

export default TailorUploadZone;
