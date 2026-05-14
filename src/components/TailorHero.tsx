const TailorHero = () => {
  return (
    <section className="relative w-full overflow-hidden bg-[#0a0a0a] text-white">
      {/* red glow at bottom */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-32 h-64 mx-auto max-w-[900px] rounded-[100%] blur-3xl opacity-40"
        style={{ background: "radial-gradient(closest-side, oklch(0.58 0.22 25 / 0.6), transparent)" }}
      />

      <div className="relative max-w-[1200px] mx-auto px-6 md:px-10 py-20 md:py-28 text-center">
        <span className="inline-flex items-center rounded-full border border-primary/60 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-primary uppercase">
          Gerador de Currículo
        </span>

        <h1 className="mt-7 text-5xl md:text-7xl font-black tracking-tight leading-[1.05]">
          Currículo <span className="text-primary">Executivo</span>
          <br />
          em segundos
        </h1>

        <p className="mt-6 text-base md:text-lg text-white/60 max-w-[620px] mx-auto leading-relaxed">
          Envie o PDF do candidato e receba instantaneamente o Word formatado no padrão oficial Tailor.
        </p>
      </div>
    </section>
  );
};

export default TailorHero;
