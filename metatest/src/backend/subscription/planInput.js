'use strict';

function flag(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
}

function readPlan(body) {
    const id = String(body?.id || '').trim().toLowerCase();
    if (!/^[a-z0-9-]{1,50}$/.test(id)) return { error: 'شناسه پلن فقط حروف انگلیسی، عدد و خط تیره است.' };
    const name = String(body?.name || '').trim();
    if (!name || name.length > 255) return { error: 'نام پلن را وارد کنید.' };
    const days = Number(body?.days);
    if (!Number.isInteger(days) || days < 1 || days > 3650) return { error: 'مدت پلن باید بین ۱ تا ۳۶۵۰ روز باشد.' };
    const price = Number(body?.price);
    if (!Number.isFinite(price) || price < 0 || price > 1e12) return { error: 'قیمت نامعتبر است.' };
    const discount = Number(body?.planDiscountPercent ?? 0);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) return { error: 'درصد تخفیف باید بین ۰ تا ۱۰۰ باشد.' };
    const sortOrder = Number(body?.sortOrder ?? 0);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 1000) return { error: 'ترتیب نمایش نامعتبر است.' };
    return {
        value: {
            id,
            name,
            days,
            price: Math.round(price),
            planDiscountPercent: Math.round(discount * 100) / 100,
            popular: flag(body?.popular) ? 1 : 0,
            isActive: body?.isActive === undefined ? 1 : (flag(body.isActive) ? 1 : 0),
            sortOrder,
        },
    };
}

module.exports = { readPlan, flag };
