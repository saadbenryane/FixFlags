export function HeroSignalBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] overflow-hidden"
    >
      <svg
        viewBox="0 0 1440 540"
        preserveAspectRatio="xMidYMin slice"
        className="h-full w-full"
      >
        <path
          d="M-80 392C210 184 458 142 737 242s464 110 783-78"
          fill="none"
          stroke="hsl(var(--border))"
          strokeOpacity="0.42"
          strokeWidth="1"
        />
        <path
          d="M-96 430C212 218 467 182 738 274s464 99 802-72"
          fill="none"
          stroke="hsl(var(--border))"
          strokeOpacity="0.28"
          strokeWidth="1"
        />
        <path
          d="M-80 392C210 184 458 142 737 242s464 110 783-78"
          fill="none"
          stroke="hsl(var(--brand))"
          strokeLinecap="round"
          strokeWidth="2"
          className="hero-signal-travel"
        />
        <circle
          cx="738"
          cy="242"
          r="4"
          fill="hsl(var(--brand))"
          opacity="0.7"
        />
        <circle
          cx="738"
          cy="242"
          r="11"
          fill="none"
          stroke="hsl(var(--brand))"
          strokeOpacity="0.18"
          className="hero-signal-pulse"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(to_bottom,transparent,hsl(var(--background)))]" />
    </div>
  );
}
