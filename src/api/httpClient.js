export const fetchWithRetry = async (url, options = {}, retry = 2, backoffMs = 450) => {
  let lastError = null;
  for (let i = 0; i <= retry; i += 1) {
    try {
      const res = await fetch(url, options);
      if (!res.ok && res.status >= 500 && i < retry) {
        await new Promise((r) => setTimeout(r, backoffMs * (i + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (i >= retry) break;
      await new Promise((r) => setTimeout(r, backoffMs * (i + 1)));
    }
  }
  throw lastError || new Error("Network request failed");
};
