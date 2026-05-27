import { Redis } from "@upstash/redis";

type RedisConfig = {
  url?: string;
  token?: string;
  redisUrl?: string;
};

function normalizeRedisConfig(config: RedisConfig) {
  if (config.url && config.token) {
    return {
      url: config.url,
      token: config.token
    };
  }

  if (!config.redisUrl) {
    return null;
  }

  const parsed = new URL(config.redisUrl);
  const token = decodeURIComponent(parsed.password);

  if (!parsed.hostname || !token) {
    return null;
  }

  return {
    url: `https://${parsed.hostname}`,
    token
  };
}

export function createRedisClient(config: RedisConfig) {
  const normalized = normalizeRedisConfig(config);

  if (!normalized) {
    return null;
  }

  return new Redis({
    url: normalized.url,
    token: normalized.token
  });
}

export const redisKeys = {
  modelCatalog: "prism:models:catalog",
  recentConversation: (conversationId: string) => `prism:conversation:${conversationId}:recent`,
  uploadStatus: (fileId: string) => `prism:file:${fileId}:status`,
  latexCompile: (hash: string) => `prism:latex:compile:${hash}`
};