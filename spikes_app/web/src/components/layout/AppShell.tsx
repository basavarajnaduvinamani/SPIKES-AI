import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppHeader } from './AppHeader'
import { AppSidebar } from './AppSidebar'
import { AppFooter } from './AppFooter'
import { ClinicalAssistant } from '../assistant/ClinicalAssistant'

const SIDEBAR_COLLAPSE_KEY = 'spikes-sidebar-collapsed'

export const AppShell = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1'
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed((c) => !c)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => {
      if (mq.matches) {
        setMobileNavOpen(false)
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <div className="relative flex h-dvh max-h-dvh min-h-0 w-full max-w-[100vw] flex-col overflow-hidden transition-colors duration-500">
      <AppHeader
        onMenuClick={() => setMobileNavOpen(true)}
        mobileDrawerOpen={mobileNavOpen}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebarCollapse={handleToggleCollapse}
      />

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <AppSidebar
          collapsed={sidebarCollapsed}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />

        <main
          id="main-content"
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-7"
          tabIndex={-1}
        >
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>

      <AppFooter />

      <ClinicalAssistant />
    </div>
  )
}
