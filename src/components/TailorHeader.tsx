import logo from "@/assets/tailor-logo.png";

const TailorHeader = () => {
  return (
    <header className="w-full border-b border-border bg-card">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 h-20 flex items-center justify-between">
        <img src={logo} alt="Tailor — made for people" className="h-8 md:h-9 w-auto" />
        <span className="hidden md:inline-flex items-center rounded-full border border-border px-4 py-1.5 text-[11px] font-bold tracking-[0.18em] text-foreground/80">
          PADRÃO TAILOR · VERSÃO 2026
        </span>
      </div>
    </header>
  );
};

export default TailorHeader;
