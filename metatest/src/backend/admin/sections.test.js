'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
    resolveSections,
    isActionAllowed,
    sanitizeSectionPatch,
    sectionAllowed,
} = require('./sections');
const { slugify, cleanCoverUrl } = require('../blog/text');
const { readPlan } = require('../subscription/planInput');

test('main admin keeps blog and plan access', () => {
    const sections = resolveSections(1, []);
    assert.equal(sections.blog, true);
    assert.equal(sections['subscription-plans'], true);
});

test('other admins do not publish until blog is granted', () => {
    const sections = resolveSections(4, []);
    assert.equal(sections.blog, false);
    assert.equal(sections['subscription-plans'], true);
    assert.equal(sections.dashboard, true);
});

test('a saved grant turns blog on for that admin only', () => {
    const sections = resolveSections(4, [{ section_key: 'blog', allowed: 1 }]);
    assert.equal(sections.blog, true);
    assert.equal(resolveSections(5, []).blog, false);
});

test('blog actions follow the section catalog', () => {
    const granted = { id: 4, sections: resolveSections(4, [{ section_key: 'blog', allowed: 1 }]) };
    const blocked = { id: 4, sections: resolveSections(4, []) };
    assert.equal(isActionAllowed(null, 'Admin_save_blog_post'), false);
    assert.equal(isActionAllowed(blocked, 'Admin_save_blog_post'), false);
    assert.equal(isActionAllowed(granted, 'Admin_delete_blog_post'), true);
    assert.equal(isActionAllowed(blocked, 'get_user_info'), true);
    assert.equal(sectionAllowed({ id: 1, isSuper: true, sections: {} }, ['blog']), true);
});

test('section patch only keeps known keys', () => {
    const patch = sanitizeSectionPatch({ blog: '1', dashboard: false, nope: true });
    assert.deepEqual(patch.blog, true);
    assert.equal(patch.dashboard, false);
    assert.equal(Object.prototype.hasOwnProperty.call(patch, 'nope'), false);
});

test('slug keeps Persian words and drops punctuation', () => {
    assert.equal(slugify('سلام دنیا!'), 'سلام-دنیا');
    assert.equal(slugify('Hello, World'), 'hello-world');
    assert.equal(cleanCoverUrl(''), null);
    assert.equal(cleanCoverUrl('javascript:alert(1)'), undefined);
    assert.equal(cleanCoverUrl('https://metatest.app/logo.png'), 'https://metatest.app/logo.png');
});

test('plan edits stay on the subscription_plans shape students already see', () => {
    const bad = readPlan({ id: 'طلایی', name: 'طلایی', days: 30, price: 10 });
    assert.equal(typeof bad.error, 'string');
    const ok = readPlan({
        id: 'bronze',
        name: 'اشتراک برنزی',
        days: 30,
        price: 12000,
        planDiscountPercent: 10,
        popular: false,
        isActive: true,
        sortOrder: 1,
    });
    assert.equal(ok.value.price, 12000);
    assert.equal(ok.value.isActive, 1);
});

test('landing no longer contains the stats section and points at plans and blog', () => {
    const home = fs.readFileSync(path.resolve(__dirname, '../../marketing/pages/HomePage.tsx'), 'utf8');
    const plans = fs.readFileSync(path.resolve(__dirname, '../../marketing/components/PlansSection.tsx'), 'utf8');
    const footer = fs.readFileSync(path.resolve(__dirname, '../../marketing/components/SiteFooter.tsx'), 'utf8');
    const blog = fs.readFileSync(path.resolve(__dirname, '../../marketing/lib/blog.ts'), 'utf8');
    assert.equal(home.includes('اعدادی که خودشان حرف می‌زنند'), false);
    assert.equal(home.includes('stats-section'), false);
    assert.equal(plans.includes('id="plans"'), true);
    assert.equal(plans.includes('/api/payments/plans'), true);
    assert.equal(footer.includes('/blog/'), true);
    assert.equal(footer.includes('#plans'), true);
    assert.equal(blog.includes('/api/blog/posts'), true);
    assert.equal(blog.includes('/api/blog/posts/'), true);
});
