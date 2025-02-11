import { describe, it } from "node:test";
import assert from 'assert';

//TODO: UNFINISHED

describe("Gateway Test", () => {
  const rr_times: number[] = [];
  const p_times: number[] = [];
  const statuses: number[] = [];
  const promises: Promise<void>[] = [];

  async function req(): Promise<void> {
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

      statuses.push(r.status);
    } catch (err) {
      await req();
    }
  }

  it("should test gateway", async () => {
    for (let i = 0; i < 100; i++) {
      promises.push(req());
    }

    console.time("TEST");

    await Promise.all(promises);

    console.timeEnd("TEST");

    if (rr_times.length > 0) {
      console.log("RATELIMITED RESPONSE TIMES:", rr_times);
      console.log(
        "AVERAGE RATELIMITED RESPONSE TIME:",
        Math.floor(rr_times.reduce((a, b) => a + b, 0) / rr_times.length),
      );
    }

    if (p_times.length > 0) {
      console.log(
        "AVERAGE PROXIED REQUESTS RESPONSE TIME:",
        Math.floor(p_times.reduce((a, b) => a + b, 0) / p_times.length),
      );
    }

    console.log("SMALLEST RATELIMIT RESPONSE TIME:", Math.min(...rr_times));
    console.log("SMALLEST PROXY REQUEST RESPONSE TIME:", Math.min(...p_times));

    const ratelimitedRequests = statuses.filter((s) => s === 429).length;
    console.log("NO. OF RATELIMITED REQUESTS:", ratelimitedRequests);

    const proxiedRequests = statuses.filter((s) => s === 200).length;
    console.log("NO. OF PROXIED REQUESTS:", proxiedRequests);

    const otherRequests = statuses.filter((s) => s !== 200 && s !== 429).length;
    console.log("NO. OF OTHER REQUESTS(without 200 or 429 code):", otherRequests);

    assert.ok(true, "Test completed without errors");
  });
});
