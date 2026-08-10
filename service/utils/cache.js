import redis from "redis";

const REDIS_CACHE = process.env.REDIS_CACHE;

const redisClient = redis.createClient({ url: REDIS_CACHE });
redisClient.on("error", (err) => console.log("Redis Client Error: ", err));
redisClient.connect();

export const getCacheItem = async (key) => {
  const item = await redisClient.get(key);
  return item ? JSON.parse(item) : null;
};

export const setCacheItem = async (key, value, expTimeSeconds) => {
  await redisClient.setEx(key, expTimeSeconds, JSON.stringify(value));
  return value;
};

export const deleteCacheItem = async (key) => {
  const deletedItem = await redisClient.getDel(key);
  return deletedItem ? true : false;
};

export const deleteCacheItemsByPattern = async (pattern) => {
  let cursor = 0;

  do {
    const res = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
    cursor = res.cursor;

    if (res.keys.length) {
      await redisClient.del(res.keys);
    }
  } while (cursor !== 0);

  return { success: true };
};

export const clearCache = async () => {
  const cacheKeys = await redisClient.keys("*");

  for (let key of cacheKeys) {
    await deleteCacheItem(key);
  }

  return { success: true };
};
