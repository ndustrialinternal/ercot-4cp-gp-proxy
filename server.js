const express   = require("express");
const cors      = require("cors");
const fetch     = require("node-fetch");
const { chromium } = require("playwright");

const DASHBOARD_URL = "https://www.gridstatus.io/dashboards/ercot-4cp-monitor-june?ref=blog.gridstatus.io";
const API_FRAGMENT  = "ercot_estimated_coincident_peak_load/query";

const app = express();
app.use(cors());        // Allow requests from any origin
app.use(express.json());

app.get("/api/ercot4cp", async (req, res) => {
  let bearer;
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();

  // Intercept requests to grab the Authorization header
  await page.route("**/*", (route, request) => {
    if (request.url().includes(API_FRAGMENT)) {
      bearer = request.headers()["authorization"];
    }
    route.continue();
  });

  // Trigger the dashboard’s JS
  await page.goto(DASHBOARD_URL, { waitUntil: "networkidle" });
  await browser.close();

  if (!bearer) {
    return res.status(500).json({ error: "Failed to capture Bearer token" });
  }

  // Now call the real API with that token
  const start = encodeURIComponent("2025-06-01T04:00:00.000Z");
  const end   = encodeURIComponent("2025-06-18T04:00:00.000Z");
  const apiUrl = `https://api.gridstatus.io/front-end/v1/datasets/${API_FRAGMENT}`
               + `?start_time=${start}&end_time=${end}`
               + `&return_format=json&json_schema=array-of-arrays`;

  const apiRes = await fetch(apiUrl, {
    headers: { Authorization: bearer }
  });
  if (!apiRes.ok) {
    return res.status(apiRes.status).send(await apiRes.text());
  }

  const data = await apiRes.json();
  res.json(data);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy listening on port ${PORT}`));
