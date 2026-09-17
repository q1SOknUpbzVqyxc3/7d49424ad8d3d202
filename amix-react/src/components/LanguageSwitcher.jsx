import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { SITE_LOCALES } from '../utils/locale'

export function LanguageSwitcher({ locale, onSelect }) {
  const [target, setTarget] = useState(null)
  const labels = {
    en: 'Site language',
    ru: 'Язык сайта',
    uk: 'Мова сайту',
    es: 'Idioma del sitio',
    cs: 'Jazyk webu'
  }
  const label = labels[locale] ?? labels.en

  useEffect(() => {
    setTarget(document.querySelector('.nav__in'))
  }, [])

  if (!target) return null

  return createPortal(
    <label className="locale-switcher">
      <span className="visually-hidden">{label}</span>
      <select aria-label={label} value={locale} onChange={(event) => onSelect(event.target.value)}>
        {SITE_LOCALES.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
      </select>
    </label>,
    target
  )
}
