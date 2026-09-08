type ComingSoonPageProps = {
  title: string
}

export const ComingSoonPage = ({ title }: ComingSoonPageProps) => {
  return (
    <section className="glass-card mx-auto w-full max-w-6xl p-5 sm:p-6">
      <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">
        {title}
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400/90">This section is coming soon.</p>
    </section>
  )
}
