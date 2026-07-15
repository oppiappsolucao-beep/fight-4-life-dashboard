const MODALIDADES = [
  {
    titulo: "JIU JITSU",
    subtitulo: "Estratégia dentro e fora do tatame",
    image: "/jiujitsu.png",
    position: "center 57%",
    fallback:
      "linear-gradient(145deg, rgba(45,40,60,0.9), rgba(15,15,15,0.95))",
  },
  {
    titulo: "MUSCULAÇÃO",
    subtitulo: "Força, condicionamento e evolução constante",
    position: "center center",
    fallback:
      "linear-gradient(145deg, rgba(50,45,40,0.9), rgba(15,15,15,0.95))",
  },
  {
    titulo: "PILATES",
    subtitulo: "Corpo alinhado, postura e bem-estar",
    position: "center center",
    fallback:
      "linear-gradient(145deg, rgba(42,50,55,0.9), rgba(15,15,15,0.95))",
  },
  {
    titulo: "NATAÇÃO",
    subtitulo: "Resistência, técnica e baixo impacto",
    position: "center center",
    fallback:
      "linear-gradient(145deg, rgba(35,50,65,0.9), rgba(15,15,15,0.95))",
  },
];

export default function ModalityCards() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {MODALIDADES.map((item) => (
        <article
          key={item.titulo}
          className="group relative min-h-[118px] overflow-hidden rounded-xl border border-white/8 transition duration-200 hover:border-white/20"
          style={{
            backgroundImage: item.image
              ? `url(${item.image}), ${item.fallback}`
              : item.fallback,
            backgroundPosition: item.position,
            backgroundSize: "cover",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/90" />
          <div className="absolute bottom-0 left-0 z-10 p-2.5">
            <h3 className="m-0 text-[0.78rem] font-bold uppercase tracking-tight text-[#e8e8e8]">
              {item.titulo}
            </h3>
            <p className="mt-0.5 text-[0.62rem] font-medium leading-tight text-[#a8a8a8]">
              {item.subtitulo}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
