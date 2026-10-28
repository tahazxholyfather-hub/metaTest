'use strict';

/** Zarinpal's real checkout is a Persian page. The sandbox 500 is an English error shell. */
function isPayableGatewayPage(status, html) {
    return Number(status) === 200 && /lang=["']fa["']/i.test(String(html || ''));
}

module.exports = { isPayableGatewayPage };
