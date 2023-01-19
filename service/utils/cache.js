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

export const clearCache = async () => {
  const cacheKeys = await redisClient.keys("*");

  for (let key of cacheKeys) {
    await deleteCacheItem(key);
  }

  return { success: true };
};
