// utils/sms.js
const axios = require('axios');

exports.sendOtpSms = async (phone, code) => {
    const url = 'http://api.payamak-panel.com/post/Send.asmx/SendByBaseNumber2';

    try {
        const response = await axios.post(url, {
            username: process.env.SMS_USERNAME,
            password: process.env.SMS_PASSWORD,
            text: `${code}`,
            to: phone,
            bodyId: 451100
        });

        // دریافت نتیجه از خروجی JSON یا XML پنل
        const result = response.data.d || response.data;

        if (typeof result === 'string' && result.length > 15) {
            return { success: true };
        }

        return { success: false, error: `پنل پیامک خطا داد: ${result}` };

    } catch (err) {
        return { success: false, error: `خطا در ارتباط با سرور پیامک: ${err.message}` };
    }
};
