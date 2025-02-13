import { Redis } from "ioredis";
import { HOST_DATA_CACHE_TTL, RedisHostData } from "./types.js";

export async function writeHostData(redis: Redis, id: string, data: RedisHostData) {
  try {
    await redis.hset(id, data);
    await redis.expire(id, HOST_DATA_CACHE_TTL);
  } catch (error) {
    console.error("Host data write failed:", error);
    throw error;
  }
}

export async function deleteHostData(redis: Redis, id: string) {
  try {
    await redis.del(id);
  } catch (error) {
    console.error("Host data delete failed:", error);
    throw error;
  }
}