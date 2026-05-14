const TailorFooter = () => {
  return (
    <footer className="w-full border-t border-border bg-card">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 h-14 flex items-center justify-between text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Tailor — made for people</span>
        <span className="font-medium uppercase tracking-wide">Para uso interno da Tailor — não compartilhe</span>
        <span>Padrão Tailor • Word (.docx)</span>
      </div>
    </footer>
  );
};

export default TailorFooter;
