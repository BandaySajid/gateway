import express from "express";
import proxy from "express-http-proxy";
import { RuleValidator } from "./rules.js";
import Redis from "ioredis";
import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { HostData, RedisHostData } from "./types.js";
import { writeHostData } from "./util.js";
import { APP_URL, ENV, GATEWAY_PORT, REDIS_URL } from './config.js';
import cors from "cors";

const redis = new Redis(REDIS_URL);

const gateway = express();
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
    const r = await fetch(url);
    const jr = await r.json();
    return jr;
  } catch (err) {
    console.log("Error Requesting host data:", err);
    return null;
  }
}

interface ProxyRequest extends express.Request {
  hostData: HostData;
}

async function proxyHandler(
  req: ProxyRequest,
  res: express.Response,
): Promise<express.Response | void> {
  let thisUrl = req.protocol + "://" + req.get("host") + req.url;
  try {
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
    url = u.origin + u.pathname;
  }

  return {
    ip, url
  }
}

async function ratelimiterMiddleware(
  req: ProxyRequest,
  res: express.Response,
  next: express.NextFunction,
) {
  try {
    res.removeHeader('x-powered-by')
    res.setHeader("gateway", "Amplizard");
    let thisUrl = req.protocol + "://" + req.get("host") + req.url;

    const hostId = req.headers["x-host-id"] as string;

    if (!hostId) {
      return res.status(403).send("Access Denied");
    }

    let data = await getHostData(hostId);

    if (!data) {
      const result = await requestHostData(hostId);
      data = result?.result;

      if (!data) {
        return res.status(401).send("Invalid host id");
      }

      await writeHostData(redis, hostId, data);
    }

    const limiter = rateLimit({
      windowMs: Number(data.period) * 1000,
      limit: Number(data.frequency),
      standardHeaders: "draft-8",
      legacyHeaders: false,
      store: new RedisStore({
        // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
        sendCommand: (...args: string[]) => redis.call(...args),
      }),
      handler: (_, response, __, ___) => {
        response.removeHeader("Cache-Control");
        response.setHeader(
          "Cache-Control",
          `public, max-age=${Number(data.duration)}, s-maxage=${Number(data.duration)}`,
        );

        return response.status(429).send("Too many requests, slow down.");
      },
    });

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
        return limiter(req, res, next);
      }
      return next();
    } else if (data.filter === "all") {
      return limiter(req, res, next);
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
  gateway.listen(GATEWAY_PORT, '127.0.0.1', () => {
    console.log("Gateway listening on PORT:", GATEWAY_PORT);
  });
}


