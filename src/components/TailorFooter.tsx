const TailorFooter = () => {
  return (
    <footer className="w-full border-t border-border bg-card">
      <div className="max-w-[860px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Tailor</span>
        <span>Padrão Tailor • Word (.docx)</span>
      </div>
    </footer>
  );
};

export default TailorFooter;
