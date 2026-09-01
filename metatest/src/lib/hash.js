// utils/hash.js
const Hashids = require('hashids/cjs');
// Use a secure salt, unique to your app
const hashids = new Hashids("YOUR_SECRET_SALT_KEY", 8); // 8 is min length

const encodeId = (id) => hashids.encodeHex(id.toString()); // If using MongoDB ObjectIds
const decodeId = (hash) => hashids.decodeHex(hash);

module.exports = { encodeId, decodeId };
