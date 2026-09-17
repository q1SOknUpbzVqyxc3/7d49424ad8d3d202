const labels = {
  en: ['trades in the journal', 'closed in profit', 'total result'],
  ru: ['сделок в журнале', 'закрыто в плюс', 'суммарный результат'],
  uk: ['угод у журналі', 'закрито в плюс', 'загальний результат'],
  es: ['operaciones en el diario', 'cerradas con beneficio', 'resultado total'],
  cs: ['obchodů v deníku', 'uzavřeno v zisku', 'celkový výsledek']
}

export function localizeLegacyContent(locale) {
  const target = document.getElementById('journalSum')
  if (!target) return
  const source = labels.ru
  const translated = labels[locale] ?? labels.en
  target.querySelectorAll('.jsum__l').forEach((node, index) => {
    if (source.includes(node.textContent) || index < translated.length) node.textContent = translated[index]
  })
}
