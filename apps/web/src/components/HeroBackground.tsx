const GYM_BG = "/hero-gym.png?v=3";

export default function HeroBackground() {
  return (
    <>
      <img
        src={GYM_BG}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[#0b1f3a]/55" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#071525]/55 via-[#0b1f3a]/30 to-[#123055]/55" />
    </>
  );
}
