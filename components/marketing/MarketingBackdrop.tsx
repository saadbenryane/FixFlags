export function MarketingBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--accent)/0.35),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.4)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.4)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
      <div className="absolute -right-24 top-32 h-72 w-72 rounded-full bg-brand/10 blur-3xl dark:bg-brand/5" />
      <div className="absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-stone-400/10 blur-3xl dark:bg-stone-600/10" />
    </div>
  )
}
