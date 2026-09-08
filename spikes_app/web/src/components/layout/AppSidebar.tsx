import { Activity, Home, Leaf, Upload, Users, X, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { id: 'home', label: 'Dashboard', Icon: Home, to: '/' },
  { id: 'cgms', label: 'CGM Spikes', Icon: Activity, to: '/cgm' },
  { id: 'overview', label: 'Patient Overview', Icon: Users, to: '/overview' },
  { id: 'pillars', label: 'Lifestyle Pillars', Icon: Leaf, to: '/pillars' },
  { id: 'upload', label: 'Data upload', Icon: Upload, to: '/upload' },
] as const satisfies ReadonlyArray<{
  id: string
  label: string
  Icon: LucideIcon
  to: string
}>

type AppSidebarProps = {
  collapsed: boolean
  mobileOpen: boolean
  onMobileClose: () => void
}

const linkClass = (isActive: boolean, collapsed: boolean) =>
  [
    'group relative flex items-center gap-2.5 overflow-hidden rounded-xl border px-2.5 py-2 text-[13px] font-medium transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wellness-500',
    isActive
      ? 'border-zinc-300/90 bg-white/80 text-slate-900 shadow-md shadow-zinc-900/5 dark:border-zinc-600/70 dark:bg-zinc-800/80 dark:text-zinc-50'
      : 'border-transparent text-slate-700 hover:translate-x-0.5 hover:border-zinc-200/80 hover:bg-white/50 hover:shadow-md dark:text-zinc-300 dark:hover:border-zinc-600/50 dark:hover:bg-zinc-800/50 dark:hover:text-white',
    collapsed ? 'md:justify-center md:px-2' : '',
  ].join(' ')

const iconWrapClass = (isActive: boolean) =>
  [
    'flex size-8 shrink-0 items-center justify-center rounded-lg border shadow-sm backdrop-blur-sm transition group-hover:scale-105',
    isActive
      ? 'border-wellness-500/35 bg-wellness-50/95 text-wellness-700 dark:border-wellness-500/30 dark:bg-wellness-950/50 dark:text-wellness-400'
      : 'border-zinc-200/80 bg-zinc-100/80 text-zinc-600 dark:border-zinc-700/60 dark:bg-zinc-800/70 dark:text-zinc-300',
  ].join(' ')

export const AppSidebar = ({ collapsed, mobileOpen, onMobileClose }: AppSidebarProps) => {
  return (
    <>
      <div
        className={[
          'fixed z-40 bg-zinc-950/40 backdrop-blur-md transition-opacity duration-300 md:hidden',
          'top-[var(--app-header-offset)] right-0 bottom-0 left-0',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        aria-hidden={!mobileOpen}
        onClick={onMobileClose}
      />

      <aside
        className={[
          'glass-sidebar flex max-w-[85vw] flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:border-r md:border-zinc-200/80 dark:md:border-zinc-700/50',
          'fixed z-50 w-64 md:static md:z-0 md:max-w-none md:min-h-0 md:shrink-0',
          'top-[var(--app-header-offset)] bottom-0 left-0 md:top-auto md:bottom-auto md:h-auto',
          collapsed ? 'md:w-[4.5rem]' : 'md:w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
        aria-label="Main navigation"
      >
        <div className="flex h-10 items-center justify-end border-b border-zinc-200/70 px-2 md:hidden dark:border-zinc-700/50">
          <button
            type="button"
            onClick={onMobileClose}
            className="flex size-9 items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/70 text-slate-600 shadow-sm backdrop-blur-md transition hover:border-zinc-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wellness-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-700/90"
            aria-label="Close sidebar"
          >
            <X className="size-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2.5 md:pt-3">
          <p
            className={[
              'mb-0.5 px-1 font-display text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500/90',
              collapsed ? 'md:sr-only' : '',
            ].join(' ')}
          >
            Workspace
          </p>
          {navItems.map((item) => {
            const ItemIcon = item.Icon
            return (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.to === '/'}
                onClick={onMobileClose}
                className={({ isActive }) => linkClass(isActive, collapsed)}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        className="absolute bottom-2 left-1.5 top-2 w-1 rounded-full bg-gradient-to-b from-wellness-400 to-emerald-600 shadow-sm dark:from-wellness-300 dark:to-emerald-500"
                        aria-hidden="true"
                      />
                    )}
                    <span className={iconWrapClass(isActive)} aria-hidden="true">
                      <ItemIcon className="size-4" strokeWidth={2} />
                    </span>
                    <span className={collapsed ? 'md:sr-only' : ''}>{item.label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div
          className={[
            'border-t border-zinc-200/70 p-2.5 dark:border-zinc-700/50',
            collapsed ? 'md:px-2' : '',
          ].join(' ')}
        >
          <div
            className={[
              'rounded-xl border border-zinc-200/70 bg-gradient-to-br from-zinc-50/95 via-white/60 to-zinc-100/70 p-2.5 shadow-inner backdrop-blur-md dark:border-zinc-700/50 dark:from-zinc-900/50 dark:via-zinc-900/35 dark:to-zinc-950/60',
              collapsed ? 'md:p-2' : '',
            ].join(' ')}
          >
            {!collapsed && (
              <p className="font-display text-[10px] font-bold uppercase tracking-wide text-wellness-700 dark:text-wellness-400">
                Quick tip
              </p>
            )}
            <p
              className={[
                'mt-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-zinc-400/90',
                collapsed ? 'md:sr-only' : '',
              ].join(' ')}
            >
              Upload CGM and pillar data to explore your metrics.
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
