import express from 'express';
import Redis from "ioredis";
import { deleteHostData } from './util.js';
import { REDIS_URL, COMMUNICATOR_PORT, COMMUNICATOR_SECRET } from './config.js';

const redis = new Redis(REDIS_URL);

const server = express();
server.use(express.json())
server.use(express.urlencoded({ extended: true }))

server.delete('/cache/hosts/:id', async (req: express.Request, res: express.Response): Promise<void> => {
  console.log('request to delete cache');
  const { id } = req.params;
  if (req.headers.authorization !== COMMUNICATOR_SECRET) {
    console.log('no auth', req.headers, COMMUNICATOR_SECRET)
    res.status(401).send({ success: false, error: "Unauthorized" });
    return
  }
  try {
    await deleteHostData(redis, id);
    res.status(200).send({ success: true });
  } catch (error) {
    console.error("Error deleting host data cache:", error);
    res.status(500).send({ success: false, error: "Error deleting host data cache" });
  }
});
export default function run() {
  server.listen(COMMUNICATOR_PORT, '127.0.0.1', () => {
    console.log(`Communication service listening on port`, COMMUNICATOR_PORT);
  });
}
