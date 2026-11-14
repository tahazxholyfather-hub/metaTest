import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageField } from '../components/PageField';
import { MailIcon, PhoneIcon, PinIcon } from '../components/icons';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { SITE_CONTACT, submitContact, validateContact, type ContactDraft, type ContactField } from '../lib/contact';

const empty: ContactDraft = { name: '', email: '', phone: '', subject: '', message: '' };

const fields: { name: ContactField; label: string; type?: string; autoComplete: string }[] = [
  { name: 'name', label: 'نام', autoComplete: 'name' },
  { name: 'email', label: 'ایمیل', type: 'email', autoComplete: 'email' },
  { name: 'phone', label: 'تلفن', type: 'tel', autoComplete: 'tel' },
  { name: 'subject', label: 'موضوع', autoComplete: 'off' },
];

export function ContactPage() {
  const [draft, setDraft] = useState<ContactDraft>(empty);
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);

  function update(field: ContactField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setNotice('');
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateContact(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice('');
      return;
    }
    setSending(true);
    try {
      const result = await submitContact(draft, website);
      setErrors(result.errors);
      setNotice(result.ok ? (result.message || 'پیام شما ثبت شد.') : (result.message || 'ثبت پیام ممکن نشد. کمی بعد دوباره تلاش کنید.'));
      if (result.ok) setDraft(empty);
    } catch {
      setNotice('ثبت پیام ممکن نشد. کمی بعد دوباره تلاش کنید.');
    } finally {
      setSending(false);
    }
  }

  return (
    <PageField>
      <SiteHeader active="contact" />
      <main className="page-wide">
        <div className="page-hero">
          <nav className="breadcrumbs" aria-label="مسیر">
            <ol>
              <li><Link to="/">خانه</Link></li>
              <li><span aria-current="page">تماس</span></li>
            </ol>
          </nav>
          <p className="sec-eyebrow">تماس</p>
          <h1 className="page-title shine-title">راه‌های ارتباطی منتشرشده</h1>
          <p className="page-lede">فقط تلفن، ایمیل و نشانی‌ای اینجا آمده که در معرفی متاتست وجود دارد. شبکه اجتماعی جداگانه‌ای اعلام نشده است.</p>
        </div>
        <div className="contact-layout">
          <ul className="contact-cards">
            <li className="glass-panel">
              <PhoneIcon />
              <div>
                <h2>تلفن</h2>
                <a href={SITE_CONTACT.phoneHref} dir="ltr">{SITE_CONTACT.phone}</a>
              </div>
            </li>
            <li className="glass-panel">
              <MailIcon />
              <div>
                <h2>ایمیل</h2>
                <a href={SITE_CONTACT.emailHref} dir="ltr">{SITE_CONTACT.email}</a>
              </div>
            </li>
            <li className="glass-panel">
              <PinIcon />
              <div>
                <h2>نشانی</h2>
                <p>{SITE_CONTACT.address}</p>
              </div>
            </li>
          </ul>
          <form className="contact-form" onSubmit={onSubmit} noValidate>
            <p className="form-note">ایمیل یا تلفن کافی است. پیام در پنل پشتیبانی ثبت می‌شود.</p>
            <label className="contact-trap" htmlFor="contact-website">
              وب‌سایت
              <input id="contact-website" name="website" value={website} tabIndex={-1} autoComplete="off" onChange={(event) => setWebsite(event.target.value)} />
            </label>
            {fields.map((field) => (
              <label key={field.name} htmlFor={`contact-${field.name}`}>
                <span>{field.label}</span>
                <input
                  id={`contact-${field.name}`}
                  name={field.name}
                  type={field.type ?? 'text'}
                  autoComplete={field.autoComplete}
                  value={draft[field.name]}
                  aria-invalid={errors[field.name] ? true : undefined}
                  aria-describedby={errors[field.name] ? `contact-${field.name}-error` : undefined}
                  onChange={(event) => update(field.name, event.target.value)}
                />
                {errors[field.name] ? <small id={`contact-${field.name}-error`} role="alert">{errors[field.name]}</small> : null}
              </label>
            ))}
            <label htmlFor="contact-message">
              <span>پیام</span>
              <textarea
                id="contact-message"
                name="message"
                rows={6}
                value={draft.message}
                aria-invalid={errors.message ? true : undefined}
                aria-describedby={errors.message ? 'contact-message-error' : undefined}
                onChange={(event) => update('message', event.target.value)}
              />
              {errors.message ? <small id="contact-message-error" role="alert">{errors.message}</small> : null}
            </label>
            <button type="submit" className="btn-fill" disabled={sending}>
              {sending ? 'در حال ثبت…' : 'ثبت پیام'}
            </button>
            <p className="form-status" role="status" aria-live="polite">{notice}</p>
          </form>
        </div>
      </main>
      <SiteFooter variant="sub" enamadClass />
    </PageField>
  );
}
