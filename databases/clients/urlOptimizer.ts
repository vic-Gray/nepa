const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const setIfMissing = (url: URL, key: string, value: string) => {
  if (!url.searchParams.has(key)) {
    url.searchParams.set(key, value);
  }
};

export const buildOptimizedDatabaseUrl = (rawUrl: string | undefined): string | undefined => {
  if (!rawUrl) {
    return rawUrl;
  }

  try {
    const url = new URL(rawUrl);

    const connectionLimit = parsePositiveInt(process.env.DB_CONNECTION_LIMIT, 20);
    const poolTimeout = parsePositiveInt(process.env.DB_POOL_TIMEOUT_SECONDS, 15);
    const connectTimeout = parsePositiveInt(process.env.DB_CONNECT_TIMEOUT_SECONDS, 10);

    setIfMissing(url, 'connection_limit', String(connectionLimit));
    setIfMissing(url, 'pool_timeout', String(poolTimeout));
    setIfMissing(url, 'connect_timeout', String(connectTimeout));

    if (process.env.DB_USE_PGBOUNCER === 'true') {
      setIfMissing(url, 'pgbouncer', 'true');
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
};
