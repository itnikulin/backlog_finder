function requireEnv(name, env = process.env) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function loadConfig(env = process.env) {
  const rawBaseUrl = requireEnv("KAITEN_BASE_URL", env);
  let baseUrl;

  try {
    baseUrl = new URL(rawBaseUrl);
  } catch {
    throw new Error("KAITEN_BASE_URL must be an absolute URL");
  }

  if (!/^https?:$/.test(baseUrl.protocol)) {
    throw new Error("KAITEN_BASE_URL must use http or https");
  }

  return {
    baseUrl: baseUrl.toString().replace(/\/$/, ""),
    token: requireEnv("KAITEN_API_TOKEN", env),
    allowedBoardIds: parseBoardIds(requireEnv("KAITEN_ALLOWED_BOARD_IDS", env)),
    apiVersion: env.KAITEN_API_VERSION?.trim() || "latest",
    requestTimeoutMs: Number(env.KAITEN_REQUEST_TIMEOUT_MS || 30_000),
  };
}

export function parseBoardIds(value) {
  const parts = value.split(",").map((part) => part.trim());
  if (parts.some((part) => !/^[1-9]\d*$/.test(part) || !Number.isSafeInteger(Number(part)))) {
    throw new Error("KAITEN_ALLOWED_BOARD_IDS must contain positive integer IDs separated by commas");
  }
  return [...new Set(parts.map(Number))];
}
