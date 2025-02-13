import dotenv from 'dotenv';
dotenv.config();

export const GATEWAY_PORT = (process.env.GATEWAY_PORT && Number(process.env.GATEWAY_PORT)) || 9090;
export const COMMUNICATOR_PORT = (process.env.COMMUNICATOR_PORT && Number(process.env.COMMUNICATOR_PORT)) || 9050;
export const APP_URL = process.env.APP_URL || "";
export const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
export const ENV = process.env.ENV || "development";
export const COMMUNICATOR_SECRET = process.env.COMMUNICATOR_SECRET || "sd098fds09f8sd908fs09df809sd8f21"