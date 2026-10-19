const { ZarinPal } = require('zarinpal-node-sdk');

const isSandbox = String(process.env.ZARINPAL_SANDBOX).toLowerCase() === 'true';

const zarinpal = new ZarinPal({
    merchantId: process.env.ZARINPAL_MERCHANT_ID,
    sandbox: isSandbox,
});
zarinpal.isSandbox = isSandbox;

const GATEWAY_ATTEMPTS = 2;

function exposeError(message, status) {
    const err = new Error(message);
    err.expose = true;
    err.status = status;
    return err;
}

function isRateLimited(body) {
    const code = body?.errors?.code;
    const message = String(body?.errors?.message || '');
    return code === -12 || /to+ many attempts/i.test(message);
}

/**
 * Ask Zarinpal for an authority and return the URL the browser should open.
 * The Node app on cPanel often cannot render StartPay itself (redirect or an
 * empty body). A valid authority is still handed to the user.
 */
async function createPayableUrl(payload) {
    let lastReject = 'درگاه پرداخت درخواست را نپذیرفت.';
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
        if (requestData.code === 100 && authority) {
            return {
                authority,
                paymentUrl: zarinpal.payments.getRedirectUrl(authority),
                paymentRequest,
                sandbox: isSandbox,
            };
        }

        const remote = String(requestData.message || paymentRequest?.errors?.message || '').trim();
        if (remote) lastReject = `درگاه پرداخت درخواست را نپذیرفت: ${remote.slice(0, 160)}`;
        if (isRateLimited(paymentRequest)) {
            throw exposeError('درگاه پرداخت شلوغ است. یک دقیقه بعد دوباره تلاش کنید.', 503);
        }
        console.error('[zarinpal] payment request rejected', requestData.code, 'attempt', attempt);
    }

    throw exposeError(lastReject, 502);
}

zarinpal.createPayableUrl = createPayableUrl;

module.exports = zarinpal;
