// Stub so Vercel Git builds recognize api/index.js before `npm run build` overwrites this file.
module.exports = async function handler(_req, res) {
  res.statusCode = 503;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: false, error: "api stub — build did not replace api/index.js" }));
};
