import { useEffect, useState } from 'react'
import { ChevronDown, Menu, Moon, Sun } from 'lucide-react'
import { useDatasets } from '../../context/DatasetProvider'
import { useTheme } from '../../context/ThemeProvider'

type AppHeaderProps = {
  onMenuClick: () => void
  mobileDrawerOpen: boolean
  sidebarCollapsed: boolean
  onToggleSidebarCollapse: () => void
}

const MD_UP = '(min-width: 768px)'

const iconBtnBase =
  'flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200/80 bg-white/60 text-slate-700 shadow-sm backdrop-blur-md transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-zinc-300 hover:bg-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wellness-500 active:scale-[0.96] dark:border-zinc-700/60 dark:bg-zinc-800/60 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-700/70 dark:hover:text-white'

const selectClass =
  'h-8 w-full min-w-0 max-w-full cursor-pointer appearance-none rounded-lg border border-zinc-200/80 bg-white/70 py-1 pl-2 pr-7 text-[11px] font-medium text-slate-800 shadow-sm backdrop-blur-sm transition hover:border-zinc-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wellness-500 dark:border-zinc-700/60 dark:bg-zinc-800/70 dark:text-zinc-100 dark:hover:border-zinc-600 sm:h-9 sm:pr-8 sm:text-xs'

export const AppHeader = ({
  onMenuClick,
  mobileDrawerOpen,
  sidebarCollapsed,
  onToggleSidebarCollapse,
}: AppHeaderProps) => {
  const { theme, toggleTheme } = useTheme()
  const { patientIds, selectedPatientId, setSelectedPatientId } = useDatasets()
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MD_UP).matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia(MD_UP)
    const onChange = () => setIsDesktop(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const handleSidebarClick = () => {
    if (isDesktop) {
      onToggleSidebarCollapse()
      return
    }
    onMenuClick()
  }

  const handlePatientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    setSelectedPatientId(id || null)
  }

  const hasPatients = patientIds.length > 0

  return (
    <header className="glass-header z-30 flex min-h-12 shrink-0 flex-col md:min-h-[3.75rem]" role="banner">
      <div className="flex items-center gap-2 py-1.5 pl-2 pr-2.5 sm:gap-2.5 sm:pl-2.5 sm:pr-3">
        <button
          type="button"
          onClick={handleSidebarClick}
          className={iconBtnBase}
          aria-label={
            isDesktop
              ? sidebarCollapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
              : 'Open sidebar'
          }
          aria-expanded={isDesktop ? undefined : mobileDrawerOpen}
        >
          <Menu className="size-5" strokeWidth={2} aria-hidden="true" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
          <div
            className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/50 bg-gradient-to-br from-emerald-400 via-wellness-500 to-emerald-800 text-white shadow-md shadow-emerald-600/25 ring-1 ring-white/25 sm:size-9 dark:border-emerald-500/30 dark:from-wellness-500 dark:via-emerald-700 dark:to-wellness-900 dark:shadow-emerald-950/50 dark:ring-emerald-400/20"
            aria-hidden="true"
          >
            <span className="absolute inset-0 bg-gradient-to-tr from-white/25 to-transparent" />
            <span className="font-display relative text-xs font-bold tracking-tight drop-shadow-sm sm:text-sm">
              S
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <h1 className="font-display text-sm font-bold tracking-tight sm:text-base">
                <span className="text-gradient-brand">SPIKES</span>
                <span className="text-slate-400 dark:text-zinc-500"> · </span>
                <span className="text-slate-800 dark:text-zinc-100">Wellness</span>
              </h1>
              <span className="hidden rounded-full border border-zinc-200/90 bg-zinc-100/80 px-1.5 py-px font-sans text-[9px] font-semibold uppercase tracking-wider text-wellness-700 backdrop-blur-sm sm:inline dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-wellness-400">
                Beta
              </span>
            </div>
            <p className="mt-px max-w-md truncate text-[11px] leading-snug text-slate-600/95 dark:text-zinc-400/90 sm:text-xs">
              CGM insights for healthier days
            </p>
          </div>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-1.5 border-l border-zinc-200/80 pl-2 dark:border-zinc-700/50 sm:gap-2 sm:pl-2.5">
          <label htmlFor="patient-select" className="sr-only">
            Patient
          </label>
          <div className="relative w-[min(38vw,9.5rem)] min-w-0 sm:w-44 md:w-52">
            <select
              id="patient-select"
              value={hasPatients ? (selectedPatientId ?? '') : ''}
              onChange={handlePatientChange}
              disabled={!hasPatients}
              className={selectClass}
              aria-label="Select patient"
            >
              {!hasPatients ? (
                <option value="">No patients — upload CSVs with Client ID</option>
              ) : (
                patientIds.map((pid) => (
                  <option key={pid} value={pid}>
                    {pid}
                  </option>
                ))
              )}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-slate-500 sm:right-2 sm:size-3.5 dark:text-zinc-400"
              strokeWidth={2}
              aria-hidden="true"
            />
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className={iconBtnBase}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? (
              <Moon className="size-[1.125rem]" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Sun className="size-[1.125rem]" strokeWidth={2} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      <div className="glass-header-line shrink-0 opacity-90 dark:opacity-70" aria-hidden="true" />
    </header>
  )
}
