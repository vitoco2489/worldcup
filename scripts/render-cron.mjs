const base = process.env.BACKEND_URL?.replace(/\/$/, "");
const secret = process.env.CRON_SECRET ?? "";

if (!base) {
  console.error("BACKEND_URL is required");
  process.exit(1);
}

const res = await fetch(`${base}/jobs/run`, {
  method: "POST",
  headers: { "X-Cron-Secret": secret },
});

const text = await res.text();
console.log(text);
process.exit(res.ok ? 0 : 1);
