import express, { RequestHandler } from "express";
import proxy from "express-http-proxy";
import { RuleValidator } from "./rules.js";
import Redis from "ioredis";
import { HostData, RedisHostData } from "./types.js";
import { writeHostData } from "./util.js";
import {
  APP_URL,
  COMMUNICATOR_SECRET,
  ENV,
  GATEWAY_PORT,
  REDIS_URL,
} from "./config.js";
import cors from "cors";
import { RateLimiterRedis } from "rate-limiter-flexible";

interface ProxyRequest extends express.Request {
  hostData: HostData;
  ratelimitCached: string | null;
  hostId: string | null;
}

const redis = new Redis(REDIS_URL);

const USAGE_LIMIT = 100000; //100k limit for free plan. TODO: change this.

const gateway = express();
gateway.set("trust proxy", 1);
gateway.use(express.urlencoded({ extended: true }));
gateway.use(express.json());
gateway.use(cors());

async function getHostData(id: string): Promise<RedisHostData | null> {
  try {
    const data = await redis.hgetall(id);
    return Object.keys(data).length <= 0 ? null : (data as RedisHostData);
  } catch (error) {
    console.error("Host data read failed:", error);
    return null;
  }
}

async function requestHostData(hostId: string) {
  const url = `${APP_URL}/gateway/rules/${hostId}`;
  try {
    const r = await fetch(url, {
      headers: {
        Authorization: COMMUNICATOR_SECRET,
      },
    });
    const jr = await r.json();
    return jr;
  } catch (err) {
    console.log("Error Requesting host data:", err);
    return null;
  }
}

async function proxyHandler(
  req: ProxyRequest,
  res: express.Response,
): Promise<express.Response | void> {
  let thisUrl = req.protocol + "://" + req.get("host") + req.url;
  try {
    if (req.ratelimitCached === "true") {
      await redis.del(`${req.hostId}:ratelimitCached`);
    }
    const data = req.hostData as HostData;

    let u = new URL(thisUrl);
    u.hostname = data.host;
    u.port = data.port || "";
    u.pathname = u.pathname;
    u.protocol = data.protocol;

    let target_url: string;

    if (u.pathname === "/") {
      target_url = u.origin + u.search;
    } else {
      target_url = u.toString();
    }

    if (ENV === "production") {
      let p = parseRewrittenUrl(target_url);
      target_url = p.url;
      u.href = p.url;
    }

    await redis.hincrby(req.hostId!, "usage", 1);

    proxy(target_url, {
      proxyReqPathResolver: function (_) {
        return u.pathname + u.search;
      },
    })(req, res, (err: any) => {
      console.error("Proxy error:", err);
      res.status(502).json({ success: false, error: "Bad Gateway" });
    });
  } catch (error) {
    if (error instanceof Error)
      if (error.name === "AbortError") {
        return res.status(408).send({ success: false, error: "req timed out" });
      } else {
        console.error("Error proxying URL:", error);
        return res
          .status(500)
          .send({ success: false, error: "Error proxying URL" });
      }
    return res
      .status(500)
      .send({ success: false, error: "Error proxying URL" });
  }
}

function parseRewrittenUrl(url: string) {
  const u = new URL(url);
  const ip = u.pathname.split("/").pop();
  const path = u.searchParams.get("path");

  if (path) {
    u.pathname = decodeURIComponent(path);
    u.searchParams.delete("path");
    url = u.origin + u.pathname + u.search;
  }

  return {
    ip,
    url,
  };
}

async function getRatelimiter(
  req: ProxyRequest,
  res: express.Response,
  next: express.NextFunction,
  data: RedisHostData,
) {
  try {
    const limiter = new RateLimiterRedis({
      storeClient: redis,
      points: 1,
      duration: Number(data.period),
    });

    limiter
      .consume(req.ip as string, 1)
      .then((c) => {
        console.log("consumed:", c.consumedPoints, c.remainingPoints);
        next();
      })
      .catch(async (c) => {
        if (req.ratelimitCached !== "true") {
          // const info = hReq.ratelimitInfo;
          // const rt = Math.floor(
          //   (info?.resetTime?.getTime()! - Date.now()) / 1000,
          // );

          const rt = Math.floor(c.msBeforeNext / 1000);
          res.removeHeader("Cache-Control");
          res.setHeader(
            "Cache-Control",
            `public, max-age=${rt}, s-maxage=${rt}, immutable`,
          );
          await redis.set(`${req.hostId}:ratelimitCached`, "true");
        }

        return res.status(200).json({
          status: "ratelimited",
          code: 429,
          message: "Too many requests, slow down.",
        });
      });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "internal gateway error",
    });
  }
}

async function ratelimiterMiddleware(
  req: ProxyRequest,
  res: express.Response,
  next: express.NextFunction,
) {
  try {
    res.removeHeader("x-powered-by");
    res.setHeader("gateway", "Amplizard");
    let thisUrl = req.protocol + "://" + req.get("host") + req.url;

    const hostId = req.headers["x-host-id"] as string;

    if (!hostId) {
      return res.status(403).send("Access Denied");
    }

    let data = await getHostData(hostId);
    req.ratelimitCached = await redis.get(`${hostId}:ratelimitCached`);
    req.hostId = hostId;

    if (!data) {
      const result = await requestHostData(hostId);
      data = result?.result;

      if (!data) {
        return res.status(401).send("Invalid host id");
      }

      await writeHostData(redis, hostId, data);
    }

    if (Number(data.usage) > USAGE_LIMIT) {
      return res.status(429).send("Service usage limit exceeded.");
    }

    req.hostData = {
      ...data,
      duration: Number(data.duration),
      period: Number(data.period),
      frequency: Number(data.frequency),
      expressions: data.expressions?.length > 0 && JSON.parse(data.expressions),
    };

    let ip: string | undefined;

    if (ENV === "production") {
      const p = parseRewrittenUrl(thisUrl);
      thisUrl = p.url;
      ip = p.ip;
    } else {
      ip = req.ip;
    }

    if (data.filter === "custom") {
      const expressions =
        data.expressions && typeof data.expressions === "string"
          ? JSON.parse(data.expressions)
          : null;

      const RV = new RuleValidator(
        expressions,
        thisUrl,
        req.method,
        // req.headers,
        // req.cookies,
        // req.headers["user-agent"] as string,
      );

      const rule_validation = RV.validateAll();

      if (rule_validation?.passed) {
        return getRatelimiter(req, res, next, data).catch((er) =>
          console.error("Error", er),
        );
      }
      return next();
    } else if (data.filter === "all") {
      return getRatelimiter(req, res, next, data);
    } else {
      return next();
    }
  } catch (err) {
    console.error("Error with ratelimit middleware", err);
    res.status(500).send("internal gateway error!");
  }
}

gateway.all("*", ratelimiterMiddleware as any, proxyHandler as any);

export default function run() {
  gateway.listen(GATEWAY_PORT, "127.0.0.1", () => {
    console.log("Gateway listening on PORT:", GATEWAY_PORT);
  });
}
