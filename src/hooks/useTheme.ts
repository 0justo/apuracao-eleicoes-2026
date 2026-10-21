import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

const THEME_STORAGE_KEY = 'apuracao2026_theme_oled'

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const queryTheme = params.get('theme')
      if (queryTheme === 'dark' || queryTheme === 'light') {
        return queryTheme
      }
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (saved === 'light' || saved === 'dark') {
        return saved
      }
    } catch {
      // Ignora erro de storage restrito
    }
    // Modo Escuro (True Black / OLED) é o tema PADRÃO inicial da aplicação
    return 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Ignora erro de storage
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  return { theme, setTheme, toggleTheme }
}
