import { FileText } from "lucide-react";

const TailorHeader = () => {
  return (
    <header className="w-full border-b border-border bg-card">
      <div className="max-w-[860px] mx-auto px-4 md:px-6 h-14 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
          <FileText className="w-4 h-4" />
        </div>
        <span className="font-bold tracking-wide text-foreground">TAILOR</span>
        <span className="text-xs text-muted-foreground ml-1">CV Generator</span>
      </div>
    </header>
  );
};

export default TailorHeader;
