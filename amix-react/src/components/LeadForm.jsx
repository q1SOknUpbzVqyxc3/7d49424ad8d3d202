import { useState } from 'react'
import { documents } from '../config/documents'
import { siteConfig } from '../config/site'
import { getLeadEndpoint } from '../services/apiClient'
import { getLocalizedDocumentUrl, readPersistedLocale } from '../utils/locale'

const copy = {
  en: { eyebrow: 'Contact', title: 'Tell us what you are looking for', lead: 'Leave your details and the team will contact you to discuss access and answer your questions.', name: 'Name', email: 'Email', telegram: 'Telegram username', message: 'What would you like to discuss?', consent: 'I agree to the processing of my data under the Privacy Policy.', submit: 'Send request', sending: 'Sending…', sent: 'Request sent. We will contact you shortly.', error: 'Could not send the request. Please try again or contact us on Telegram.' },
  ru: { eyebrow: 'Связаться', title: 'Расскажи, что тебе нужно', lead: 'Оставь контакты — команда свяжется с тобой, расскажет о доступе и ответит на вопросы.', name: 'Имя', email: 'Email', telegram: 'Ник в Telegram', message: 'Что хочешь обсудить?', consent: 'Я согласен на обработку данных согласно Политике конфиденциальности.', submit: 'Отправить заявку', sending: 'Отправляем…', sent: 'Заявка отправлена. Скоро свяжемся с тобой.', error: 'Не удалось отправить заявку. Попробуй ещё раз или напиши нам в Telegram.' },
  uk: { eyebrow: 'Зв’язатися', title: 'Розкажи, що тобі потрібно', lead: 'Залиш контакти — команда зв’яжеться з тобою, розповість про доступ і відповість на запитання.', name: 'Ім’я', email: 'Email', telegram: 'Нік у Telegram', message: 'Що хочеш обговорити?', consent: 'Я погоджуюся на обробку даних відповідно до Політики конфіденційності.', submit: 'Надіслати заявку', sending: 'Надсилаємо…', sent: 'Заявку надіслано. Незабаром ми зв’яжемося з тобою.', error: 'Не вдалося надіслати заявку. Спробуй ще раз або напиши нам у Telegram.' },
  es: { eyebrow: 'Contacto', title: 'Cuéntanos qué necesitas', lead: 'Déjanos tus datos y el equipo se pondrá en contacto para explicarte el acceso y responder tus preguntas.', name: 'Nombre', email: 'Email', telegram: 'Usuario de Telegram', message: '¿Qué te gustaría comentar?', consent: 'Acepto el tratamiento de mis datos conforme a la Política de privacidad.', submit: 'Enviar solicitud', sending: 'Enviando…', sent: 'Solicitud enviada. Nos pondremos en contacto contigo pronto.', error: 'No se pudo enviar la solicitud. Inténtalo de nuevo o escríbenos por Telegram.' },
  cs: { eyebrow: 'Kontakt', title: 'Napište nám, co potřebujete', lead: 'Zanechte své kontaktní údaje. Tým se vám ozve, vysvětlí možnosti přístupu a odpoví na otázky.', name: 'Jméno', email: 'E-mail', telegram: 'Uživatelské jméno na Telegramu', message: 'Co chcete probrat?', consent: 'Souhlasím se zpracováním údajů podle Zásad ochrany osobních údajů.', submit: 'Odeslat žádost', sending: 'Odesílání…', sent: 'Žádost byla odeslána. Brzy se vám ozveme.', error: 'Žádost se nepodařilo odeslat. Zkuste to znovu nebo nám napište na Telegramu.' }
}

export function LeadForm({ locale }) {
  const text = copy[locale] ?? copy.en
  const [status, setStatus] = useState('idle')
  const privacyUrl = getLocalizedDocumentUrl(documents[0], {
    siteLocale: locale,
    persistedLocale: readPersistedLocale(siteConfig.localeStorageKey)
  })

  async function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    if (!form.reportValidity()) return
    setStatus('sending')
    const fields = Object.fromEntries(new FormData(form).entries())
    fields.page = window.location.pathname
    try {
      const response = await fetch(getLeadEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(fields)
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.ok !== true) throw new Error('request failed')
      form.reset()
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  return (
    <section className="section lead-section" id="contact">
      <div className="wrap">
        <div className="head--center">
          <div className="eyebrow eyebrow--center">{text.eyebrow}</div>
          <h2 className="h2">{text.title}</h2>
          <p className="lead">{text.lead}</p>
        </div>
        <form className="lead-form card" action={getLeadEndpoint()} method="post" onSubmit={submit}>
          <input aria-hidden="true" autoComplete="off" className="lead-form__hp" name="website" tabIndex="-1" />
          <input name="kind" readOnly type="hidden" value="amix-enquiry" />
          <label><span>{text.name}</span><input autoComplete="name" maxLength="120" name="name" required /></label>
          <label><span>{text.email}</span><input autoComplete="email" maxLength="254" name="email" required type="email" /></label>
          <label><span>{text.telegram}</span><input autoComplete="off" maxLength="120" name="telegram" placeholder="@username" /></label>
          <label className="lead-form__wide"><span>{text.message}</span><textarea maxLength="2000" name="message" rows="4" /></label>
          <label className="lead-form__consent lead-form__wide"><input name="consent" required type="checkbox" value="yes" /><span><a href={privacyUrl} rel="noopener noreferrer" target="_blank">{text.consent}</a></span></label>
          <div className="lead-form__actions lead-form__wide">
            <button className="btn btn--primary" disabled={status === 'sending'} type="submit">{status === 'sending' ? text.sending : text.submit}</button>
            <p aria-live="polite" className={`lead-form__status lead-form__status--${status}`}>{status === 'sent' ? text.sent : status === 'error' ? text.error : ''}</p>
          </div>
        </form>
      </div>
    </section>
  )
}
