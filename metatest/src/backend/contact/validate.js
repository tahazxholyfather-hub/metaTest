'use strict';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, max) {
    return String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

function digits(value) {
    return String(value || '').replace(/\D/g, '');
}

function validateContact(input) {
    const draft = input && typeof input === 'object' ? input : {};
    const name = clean(draft.name, 80);
    const email = clean(draft.email, 180);
    const phone = clean(draft.phone, 24);
    const subject = clean(draft.subject, 140);
    const message = clean(draft.message, 4000);
    const errors = {};

    if (name.length < 2) errors.name = 'نام را کامل‌تر بنویسید.';
    if (subject.length < 3) errors.subject = 'موضوع را مشخص کنید.';
    if (message.length < 10) errors.message = 'متن پیام باید دست‌کم ده نویسه باشد.';
    if (!email && !phone) errors.email = 'ایمیل یا شماره تلفن را وارد کنید.';
    if (email && !EMAIL.test(email)) errors.email = 'ایمیل معتبر نیست.';
    if (phone && digits(phone).length < 8) errors.phone = 'شماره تلفن کامل نیست.';

    return {
        ok: Object.keys(errors).length === 0,
        errors,
        value: { name, email: email || null, phone: phone || null, subject, message },
    };
}

module.exports = { validateContact, digits };
