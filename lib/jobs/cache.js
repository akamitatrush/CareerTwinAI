// Cache TTL em memoria por processo. Sob escala (varios workers) trocar por Redis.
// Aqui ja basta para evitar martelar API externa em re-render/refresh.

const TTL_MS = 10 * 60 * 1000; // 10 min
const MAX_ENTRIES = 200;

const store = new Map(); // key -> { exp, value }

export function cacheGet(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.exp < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet(key, value, ttlMs = TTL_MS) {
  if (store.size >= MAX_ENTRIES) {
    // Drop o mais antigo (LRU pobre): a primeira chave inserida em Map.
    const firstKey = store.keys().next().value;
    if (firstKey !== undefined) store.delete(firstKey);
  }
  store.set(key, { exp: Date.now() + ttlMs, value });
}

export function cacheClear() {
  store.clear();
}
