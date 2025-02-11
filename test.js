const rr_times = [];
const p_times = [];
const statuses = [];
const promises = [];

async function req() {
  try {
    const then = Date.now();
    const r = await fetch("http://localhost:9090/api/hello", {
      headers: {
        "x-host-id": "8a69eaf3c3213c5eef36a8a9bddbd1b6",
      },
    });

    if (r.status === 200) {
      p_times.push(Date.now() - then);
    } else if (r.status === 429) {
      rr_times.push(Date.now() - then);
    }

    // const d = {
    //   status: r.status,
    //   server: r.headers.get("server"),
    //   cache: r.headers.get("cf-cache-status"),
    // };

    statuses.push(r.status);
  } catch (err) {
    req();
  }
}

for (let i = 0; i < 100; i++) {
  promises.push(req());
}

console.time("TEST");

Promise.all(promises).then(() => {
  console.timeEnd("TEST");
  if (rr_times.length > 0) {
    console.log("RATELIMITED RESPONSE TIMES:", rr_times);
    console.log(
      "AVERAGE RATELIMITED RESPONSE TIME:",
      Math.floor(rr_times.reduce((a, b) => a + b) / rr_times.length),
    );
  }

  if (p_times.length > 0) {
    console.log(
      "AVERAGE PROXIED REQUESTS RESPONSE TIME:",
      Math.floor(p_times.reduce((a, b) => a + b) / p_times.length),
    );
  }

  console.log("SMALLEST RATELIMIT RESPONSE TIME:", Math.min(...rr_times));
  console.log("SMALLEST PROXY REQUEST RESPONSE TIME:", Math.min(...p_times));

  console.log(
    "NO. OF RATELIMITED REQUESTS:",
    statuses.filter((s) => s === 429).length,
  );

  console.log(
    "NO. OF PROXIED REQUESTS:",
    statuses.filter((s) => s === 200).length,
  );

  console.log(
    "NO. OF OTHER REQUESTS(without 200 or 429 code):",
    statuses.filter((s) => s !== 200 && s !== 429).length,
  );
});
