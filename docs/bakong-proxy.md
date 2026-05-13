# Bakong NBC API Proxy (Cambodia VPS)

Bakong NBC API geo-blocks non-KH IPs (HTTP 403). Deploy this small proxy on a
Cambodia-based VPS (Digital Ocean SGP, EZECOM, SabayNet, AWS Phnom Penh, etc.)
and set `BAKONG_PROXY_URL` to its public URL.

## Node.js / Express proxy

```bash
mkdir bakong-proxy && cd bakong-proxy
npm init -y
npm i express node-fetch@2
```

`server.js`:
```js
const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PROXY_TOKEN = process.env.PROXY_TOKEN; // shared secret with Lovable

app.post("/v1/check_transaction_by_md5", async (req, res) => {
  if (PROXY_TOKEN && req.headers["x-proxy-token"] !== PROXY_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const auth = req.headers["authorization"];
  if (!auth) return res.status(400).json({ error: "missing_auth" });

  try {
    const r = await fetch("https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (BakongProxy/1.0)",
        Authorization: auth,
      },
      body: JSON.stringify(req.body),
      timeout: 8000,
    });
    const text = await r.text();
    res.status(r.status).type("application/json").send(text);
  } catch (e) {
    res.status(502).json({ error: "upstream_error", message: e.message });
  }
});

app.get("/health", (_, res) => res.json({ ok: true }));

app.listen(process.env.PORT || 8080, () =>
  console.log("Bakong proxy listening")
);
```

Run with PM2 + Nginx + Let's Encrypt for HTTPS.

## Configure Lovable Cloud secrets

After deploying:
1. `BAKONG_PROXY_URL` = `https://your-kh-proxy.example.com`
2. `BAKONG_PROXY_TOKEN` = the same `PROXY_TOKEN` you set on the VPS

The website's `checkTopup` automatically routes through the proxy when
`BAKONG_PROXY_URL` is set; otherwise it calls Bakong directly (will 403 from
non-KH regions).
