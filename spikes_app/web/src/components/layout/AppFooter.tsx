export const AppFooter = () => {
  const year = new Date().getFullYear()

  return (
    <footer
      className="mt-0 shrink-0 border-t border-zinc-200/60 bg-white/50 px-3 py-1 backdrop-blur-md dark:border-zinc-700/50 dark:bg-zinc-900/40"
      role="contentinfo"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[10px] leading-tight text-slate-500 sm:justify-between dark:text-zinc-400/80">
        <p className="text-center sm:text-left">
          <span className="font-medium text-slate-600 dark:text-zinc-300">© {year} SPIKES</span>
          <span className="mx-1.5 text-slate-300 dark:text-zinc-600">·</span>
          <span className="text-slate-400 dark:text-zinc-500/80">Demo · not medical advice</span>
        </p>

        <nav className="flex items-center gap-3" aria-label="Footer links">
          {[
            { label: 'Docs', href: '#' },
            { label: 'Privacy', href: '#' },
            { label: 'Support', href: '#' },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="font-medium text-slate-600 underline-offset-2 transition hover:text-wellness-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wellness-500 dark:text-wellness-400 dark:hover:text-wellness-200"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
