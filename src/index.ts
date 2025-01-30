import express from "express";
import proxy from "express-http-proxy";
import { RuleValidator, Rule } from "./rules.js";
import dotenv from "dotenv";
import Redis from "ioredis";
import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";

dotenv.config();

const PORT = process.env.PORT || 9090;
const APP_URL = process.env.APP_URL || "";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const ENV = process.env.ENV || "development";
const redis = new Redis(REDIS_URL);

const server = express();
server.use(express.urlencoded({ extended: true }));
server.use(express.json());

type RequestData = {
  request_count: number;
  duration_start: number | null;
  period_start: number | null;
  blocked: "f" | "t";
};

type HostData = {
  host: string;
  period: number;
  duration: number;
  frequency: number;
  protocol: "http" | "https";
  port?: string;
  filter: "custom" | "all";
  expressions: Rule[];
};

async function writeHostData(id: string, data: HostData) {
  try {
    await redis.hset(id, data);
  } catch (error) {
    console.error("Host data write failed:", error);
    throw error;
  }
}

async function getHostData(id: string): Promise<HostData | undefined | null> {
  try {
    const data = await redis.hgetall(id);
    return Object.keys(data).length <= 0 ? null : (data as any);
  } catch (error) {
    console.error("Host data read failed:", error);
    return null;
  }
}

async function requestHostData(hostId: string) {
  const url = `${APP_URL}/rules/${hostId}`;

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
    console.log("got host data:", req.hostData);
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

    delete req.headers["accept-encoding"]; // removing this header because serverless environments probably do not support deflate encoding.

    proxy(target_url, {
      proxyReqPathResolver: function (_) {
        return u.pathname + u.search;
      },
      userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
        userRes.setHeader("server", "Amplizard");
        return proxyResData;
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

async function ratelimiterMiddleware(
  req: ProxyRequest,
  res: express.Response,
  next: express.NextFunction,
) {
  try {
    res.setHeader("server", "Amplizard");
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

      data.period = Number(data.period) * 1000;
      data.duration = Number(data.duration) * 1000;

      await writeHostData(hostId, data);
    }

    const limiter = rateLimit({
      windowMs: data.period,
      limit: data.frequency,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      store: new RedisStore({
        // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
        sendCommand: (...args: string[]) => redis.call(...args),
      }),
    });

    req.hostData = data;

    // let ip;
    //
    // if (ENV === "production") {
    //   const u = new URL(thisUrl);
    //   ip = u.pathname.split("/").pop();
    //   const path = u.searchParams.get("path");
    //   if (path) {
    //     u.pathname = decodeURIComponent(path);
    //     thisUrl = u.origin + path;
    //   }
    // } else {
    //   ip =
    //     req.headers["x-forwarded-for"] ||
    //     req.headers["CF-Connecting-IP"] ||
    //     "127.0.0.1";
    // }

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
        //TODO:
        // res.removeHeader("Cache-Control");
        // res.setHeader(
        //   "Cache-Control",
        //   `public, max-age=20, s-maxage=${data.duration / 1000}`,
        // );
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
    res.status(500).send("internal server error!");
  }
}

server.all("*", ratelimiterMiddleware as any, proxyHandler as any);

server.listen(PORT, () => {
  console.log("Gateway listening on PORT:", PORT);
});
