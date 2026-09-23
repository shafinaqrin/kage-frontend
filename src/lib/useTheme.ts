'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Theme } from './theme'

const STORAGE_KEY = 'kage-theme'

function resolveInitialTheme(): Theme {
  return 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const resolved = stored === 'dark' || stored === 'light'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      setTheme(resolved)
    } catch {
      // storage unavailable; keep the server-safe light theme
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // storage unavailable; theme stays session-only
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme, hydrated }
}
