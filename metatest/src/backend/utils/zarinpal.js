const { ZarinPal } = require('zarinpal-node-sdk');

const zarinpal = new ZarinPal({
    merchantId: process.env.ZARINPAL_MERCHANT_ID,
    sandbox: String(process.env.ZARINPAL_SANDBOX).toLowerCase() === 'true',
});

module.exports = zarinpal;
