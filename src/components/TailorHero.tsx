const TailorHero = () => {
  return (
    <section className="w-full bg-gradient-to-b from-secondary to-background border-b border-border">
      <div className="max-w-[860px] mx-auto px-4 md:px-6 py-12 md:py-16 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
          Gere currículos no padrão Tailor
        </h1>
        <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-[560px] mx-auto leading-relaxed">
          Faça o upload do PDF do candidato e receba um documento Word formatado,
          pronto para enviar ao cliente.
        </p>
      </div>
    </section>
  );
};

export default TailorHero;
