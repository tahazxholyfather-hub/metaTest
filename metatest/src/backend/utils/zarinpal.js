const { ZarinPal } = require('zarinpal-node-sdk');
const { isPayableGatewayPage } = require('./gatewayPage');

const zarinpal = new ZarinPal({
    merchantId: process.env.ZARINPAL_MERCHANT_ID,
    sandbox: String(process.env.ZARINPAL_SANDBOX).toLowerCase() === 'true',
});

const GATEWAY_ATTEMPTS = 2;

function exposeError(message, status) {
    const err = new Error(message);
    err.expose = true;
    err.status = status;
    return err;
}

function readJson(text) {
    try {
        return JSON.parse(text);
    } catch (_) {
        return null;
    }
}

function isRateLimited(body) {
    const code = body?.errors?.code;
    const message = String(body?.errors?.message || '');
    return code === -12 || /to+ many attempts/i.test(message);
}

/**
 * Sandbox StartPay sometimes returns HTTP 500 for a valid authority.
 * Open the page once here and ask for a fresh authority when that happens,
 * so the browser is not sent to a dead checkout.
 */
async function createPayableUrl(payload) {
    for (let attempt = 1; attempt <= GATEWAY_ATTEMPTS; attempt++) {
        let paymentRequest;
        try {
            paymentRequest = await zarinpal.payments.create(payload);
        } catch (error) {
            if (isRateLimited(error.response?.data)) {
                throw exposeError('درگاه پرداخت شلوغ است. یک دقیقه بعد دوباره تلاش کنید.', 503);
            }
            throw error;
        }

        const requestData = paymentRequest?.data || {};
        const authority = requestData.authority || null;
        if (requestData.code !== 100 || !authority) {
            throw exposeError('درگاه پرداخت درخواست را نپذیرفت.', 502);
        }

        const paymentUrl = zarinpal.payments.getRedirectUrl(authority);
        let status = 0;
        let html = '';
        try {
            const page = await fetch(paymentUrl, { redirect: 'manual' });
            status = page.status;
            html = await page.text();
        } catch (error) {
            console.error('[zarinpal] StartPay request failed', error.message);
            continue;
        }

        if (isRateLimited(readJson(html))) {
            throw exposeError('درگاه پرداخت شلوغ است. یک دقیقه بعد دوباره تلاش کنید.', 503);
        }
        if (isPayableGatewayPage(status, html)) {
            return { authority, paymentUrl, paymentRequest };
        }
        console.error('[zarinpal] StartPay unavailable', status, 'attempt', attempt);
    }

    throw exposeError('صفحه پرداخت زرین‌پال باز نشد. چند لحظه بعد دوباره تلاش کنید.', 502);
}

zarinpal.createPayableUrl = createPayableUrl;

module.exports = zarinpal;
