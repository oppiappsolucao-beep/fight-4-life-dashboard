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
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/25 to-black/50" />
    </>
  );
}
