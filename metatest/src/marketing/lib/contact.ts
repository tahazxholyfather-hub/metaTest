export type ContactDraft = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

export type ContactField = keyof ContactDraft;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SITE_CONTACT = {
  phone: '09120578911',
  phoneHref: 'tel:09120578911',
  email: 'metatestinfo@gmail.com',
  emailHref: 'mailto:metatestinfo@gmail.com',
  address: 'مشهد، بلوار سجاد، امین غربی ۴، پلاک ۶، ساختمان A10',
  hours: [
    { label: 'شنبه تا چهارشنبه', value: '۱۰ تا ۱۸' },
    { label: 'پنجشنبه', value: '۱۰ تا ۱۳' },
    { label: 'جمعه', value: 'تعطیل' },
  ],
};

export function validateContact(draft: ContactDraft) {
  const errors: Partial<Record<ContactField, string>> = {};
  const name = draft.name.trim();
  const email = draft.email.trim();
  const phone = draft.phone.trim();
  const subject = draft.subject.trim();
  const message = draft.message.trim();

  if (name.length < 2) errors.name = 'نام را کامل‌تر بنویسید.';
  if (subject.length < 3) errors.subject = 'موضوع را مشخص کنید.';
  if (message.length < 10) errors.message = 'متن پیام باید دست‌کم ده نویسه باشد.';
  if (!email && !phone) errors.email = 'ایمیل یا شماره تلفن را وارد کنید.';
  if (email && !emailPattern.test(email)) errors.email = 'ایمیل معتبر نیست.';
  if (phone && phone.replace(/\D/g, '').length < 8) errors.phone = 'شماره تلفن کامل نیست.';
  return errors;
}

export async function submitContact(draft: ContactDraft, website = '') {
  const response = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...draft, website }),
  });
  const payload = await response.json().catch(() => ({})) as {
    success?: boolean;
    message?: string;
    errors?: Partial<Record<ContactField, string>>;
  };
  return {
    ok: response.ok && payload.success === true,
    message: payload.message || '',
    errors: payload.errors || {},
  };
}
