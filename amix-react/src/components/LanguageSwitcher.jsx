import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { SITE_LOCALES } from '../utils/locale'

export function LanguageSwitcher({ locale, onSelect }) {
  const [target, setTarget] = useState(null)

  useEffect(() => {
    setTarget(document.querySelector('.nav__in'))
  }, [])

  if (!target) return null

  return createPortal(
    <label className="locale-switcher">
      <span className="visually-hidden">Язык</span>
      <select aria-label="Язык сайта" value={locale} onChange={(event) => onSelect(event.target.value)}>
        {SITE_LOCALES.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
      </select>
    </label>,
    target
  )
}
