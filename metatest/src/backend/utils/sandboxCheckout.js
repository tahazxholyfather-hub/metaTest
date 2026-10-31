'use strict';

const crypto = require('crypto');

const TOKEN_TTL_MS = 20 * 60 * 1000;

function isSandboxEnabled() {
    return String(process.env.ZARINPAL_SANDBOX).toLowerCase() === 'true';
}

function secret() {
    return process.env.PAYMENT_RESULT_SECRET || process.env.JWT_SECRET || 'change-me-payment-result-secret';
}

function base64UrlEncode(value) {
    return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
    const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function sign(payload) {
    return crypto.createHmac('sha256', secret()).update(payload).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createSandboxToken(fields) {
    const payload = JSON.stringify({
        kind: fields.kind === 'coins' ? 'coins' : 'plan',
        id: Number(fields.id),
        authority: String(fields.authority || ''),
        amountToman: Math.round(Number(fields.amountToman) || 0),
        title: String(fields.title || 'پرداخت متاتست').slice(0, 80),
        exp: Date.now() + TOKEN_TTL_MS,
    });
    const encoded = base64UrlEncode(payload);
    return `${encoded}.${sign(encoded)}`;
}

function readSandboxToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;
    const expected = sign(encoded);
    const providedBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;
    let payload;
    try {
        payload = JSON.parse(base64UrlDecode(encoded));
    } catch (_) {
        return null;
    }
    if (!payload || !payload.exp || Date.now() > payload.exp) return null;
    if (!payload.authority || !Number(payload.id)) return null;
    if (payload.kind !== 'plan' && payload.kind !== 'coins') return null;
    return payload;
}

function checkoutPath(fields) {
    return `/api/payments/sandbox/checkout?token=${encodeURIComponent(createSandboxToken(fields))}`;
}

function digitsOnly(value) {
    return String(value || '').replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/\D/g, '');
}

function validateCard(body) {
    const card = digitsOnly(body && body.card);
    const expiry = digitsOnly(body && body.expiry);
    const cvv = digitsOnly(body && body.cvv);
    if (card.length !== 16) return 'شماره کارت باید ۱۶ رقم باشد.';
    if (expiry.length !== 4) return 'تاریخ انقضا را به صورت ماه و سال وارد کنید.';
    const month = Number(expiry.slice(0, 2));
    if (month < 1 || month > 12) return 'ماه انقضا معتبر نیست.';
    if (cvv.length < 3 || cvv.length > 4) return 'رمز CVV2 باید ۳ یا ۴ رقم باشد.';
    return '';
}

function formatToman(amount) {
    return Math.round(Number(amount) || 0).toLocaleString('fa-IR');
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderCheckout(payload, { error = '', token = '' } = {}) {
    const title = escapeHtml(payload.title);
    const amount = formatToman(payload.amountToman);
    const safeToken = escapeHtml(token);
    const errorHtml = error ? `<p class="error">${escapeHtml(error)}</p>` : '';
    const cancel = payload.kind === 'coins'
        ? `/api/payments/zarinpal/callback?coinPurchaseId=${encodeURIComponent(payload.id)}&Status=NOK&Authority=${encodeURIComponent(payload.authority)}`
        : `/api/payments/zarinpal/callback?paymentId=${encodeURIComponent(payload.id)}&Status=NOK&Authority=${encodeURIComponent(payload.authority)}`;
    return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>درگاه پرداخت آزمایشی</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; font-family: Tahoma, "Segoe UI", sans-serif; background: #e8edf5; color: #172033; }
  header { background: #0f2744; color: #fff; padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; }
  header strong { font-size: 16px; }
  header span { font-size: 12px; opacity: .8; }
  main { max-width: 460px; margin: 28px auto; padding: 0 16px 32px; }
  .card { background: #fff; border-radius: 18px; box-shadow: 0 16px 40px rgba(15, 39, 68, .12); overflow: hidden; }
  .summary { padding: 22px 22px 8px; }
  .merchant { font-size: 13px; color: #5c6b82; }
  h1 { margin: 6px 0 0; font-size: 18px; }
  .amount { margin: 18px 0 8px; font-size: 28px; font-weight: 800; }
  .amount small { font-size: 13px; font-weight: 600; margin-right: 6px; color: #5c6b82; }
  form { padding: 8px 22px 22px; display: grid; gap: 12px; }
  label { display: grid; gap: 6px; font-size: 12px; color: #34445c; font-weight: 700; }
  input { width: 100%; border: 1px solid #d5deea; border-radius: 12px; padding: 12px 14px; font-size: 16px; letter-spacing: .04em; }
  input:focus { outline: 2px solid #1d4e89; border-color: transparent; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  button { border: 0; border-radius: 12px; background: #0f2744; color: #fff; font-weight: 800; font-size: 15px; padding: 14px; cursor: pointer; }
  button:hover { background: #16365f; }
  .cancel { display: block; text-align: center; color: #5c6b82; font-size: 12px; margin-top: 4px; }
  .error { margin: 0; background: #fff1f1; color: #9f1239; border-radius: 10px; padding: 10px 12px; font-size: 12px; }
  .note { margin: 14px 4px 0; color: #5c6b82; font-size: 11px; line-height: 1.7; }
</style>
</head>
<body>
<header>
  <strong>درگاه پرداخت آزمایشی</strong>
  <span>Sandbox</span>
</header>
<main>
  <section class="card">
    <div class="summary">
      <div class="merchant">پرداخت به متاتست</div>
      <h1>${title}</h1>
      <div class="amount">${amount}<small>تومان</small></div>
    </div>
    <form method="post" action="/api/payments/sandbox/complete" autocomplete="off">
      <input type="hidden" name="token" value="${safeToken}" />
      ${errorHtml}
      <label>شماره کارت
        <input name="card" inputmode="numeric" maxlength="19" placeholder="6037 9977 1234 5678" required />
      </label>
      <div class="row">
        <label>تاریخ انقضا
          <input name="expiry" inputmode="numeric" maxlength="5" placeholder="08 / 09" required />
        </label>
        <label>CVV2
          <input name="cvv" inputmode="numeric" maxlength="4" placeholder="123" required />
        </label>
      </div>
      <button type="submit">پرداخت ${amount} تومان</button>
      <a class="cancel" href="${cancel}">انصراف و بازگشت</a>
    </form>
  </section>
  <p class="note">این صفحه فقط در حالت لوکال و سندباکس است. پولی از کارت کم نمی‌شود. هر شماره ۱۶ رقمی را می‌توانی وارد کنی.</p>
</main>
</body>
</html>`;
}

function showSandboxCheckout(req, res) {
    if (!isSandboxEnabled()) return res.status(404).send('Not found');
    const payload = readSandboxToken(req.query.token);
    if (!payload) return res.status(400).type('html').send(renderCheckout({ title: 'نشست پرداخت', amountToman: 0, kind: 'plan', id: 0, authority: '' }, { error: 'این پرداخت منقضی شده. دوباره از برنامه درخواست بده.', token: '' }));
    res.type('html').send(renderCheckout(payload, { token: String(req.query.token) }));
}

function completeSandboxCheckout(req, res) {
    if (!isSandboxEnabled()) return res.status(404).send('Not found');
    const token = req.body && req.body.token;
    const payload = readSandboxToken(token);
    if (!payload) return res.status(400).type('html').send(renderCheckout({ title: 'نشست پرداخت', amountToman: 0, kind: 'plan', id: 0, authority: '' }, { error: 'این پرداخت منقضی شده. دوباره از برنامه درخواست بده.' }));
    const error = validateCard(req.body || {});
    if (error) return res.status(400).type('html').send(renderCheckout(payload, { error, token }));
    const params = new URLSearchParams({
        Status: 'OK',
        Authority: payload.authority,
        sandboxToken: token,
    });
    if (payload.kind === 'coins') params.set('coinPurchaseId', String(payload.id));
    else params.set('paymentId', String(payload.id));
    return res.redirect(303, `/api/payments/zarinpal/callback?${params.toString()}`);
}

function readSandboxApproval(query) {
    if (!isSandboxEnabled()) return null;
    const payload = readSandboxToken(query && query.sandboxToken);
    if (!payload) return null;
    if (String(query.Status || '') !== 'OK') return null;
    if (String(query.Authority || '') !== payload.authority) return null;
    return payload;
}

module.exports = {
    isSandboxEnabled,
    createSandboxToken,
    readSandboxToken,
    checkoutPath,
    validateCard,
    showSandboxCheckout,
    completeSandboxCheckout,
    readSandboxApproval,
};
