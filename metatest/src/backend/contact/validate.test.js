'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateContact } = require('./validate');

test('contact form accepts a name, subject, message, and one way to reply', () => {
    const result = validateContact({
        name: 'امیر',
        email: 'amir@metatest.app',
        phone: '',
        subject: 'پشتیبانی اشتراک',
        message: 'سلام، درباره اشتراک سوال دارم.',
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.email, 'amir@metatest.app');
    assert.equal(result.value.phone, null);
});

test('contact form asks for a reply path and a real message', () => {
    const result = validateContact({ name: 'ا', email: 'نه', phone: '۱۲۳', subject: 'خ', message: 'کوتاه' });
    assert.equal(result.ok, false);
    assert.equal(result.errors.name, 'نام را کامل‌تر بنویسید.');
    assert.equal(result.errors.email, 'ایمیل معتبر نیست.');
    assert.equal(result.errors.phone, 'شماره تلفن کامل نیست.');
    assert.equal(result.errors.subject, 'موضوع را مشخص کنید.');
    assert.equal(result.errors.message, 'متن پیام باید دست‌کم ده نویسه باشد.');
});

test('phone alone is enough when the email is empty', () => {
    const result = validateContact({
        name: 'سارا',
        email: '   ',
        phone: '09120578911',
        subject: 'تماس',
        message: 'لطفا با من تماس بگیرید.',
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.phone, '09120578911');
});
