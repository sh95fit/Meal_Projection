// lib/cache.ts
// ──────────────────────────────────────────────────────────────────
// 서버 측 인메모리 캐시
// 서버리스 인스턴스가 살아있는 동안 유지 (cold start 시 초기화)
// ──────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
  }
  
  const store = new Map<string, CacheEntry<unknown>>();
  
  /**
   * 캐시에서 데이터를 가져오거나, 없으면 fetcher를 실행하고 캐시에 저장
   * @param key     캐시 키
   * @param ttlMs   유효기간 (밀리초)
   * @param fetcher 데이터 로드 함수
   */
  export async function cached<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const now = Date.now();
    const entry = store.get(key) as CacheEntry<T> | undefined;
  
    if (entry && entry.expiresAt > now) {
      return entry.data;
    }
  
    const data = await fetcher();
    store.set(key, { data, expiresAt: now + ttlMs });
    return data;
  }
  
  /** 특정 키의 캐시를 무효화 */
  export function invalidateCache(key: string): void {
    store.delete(key);
  }
  
  /** 특정 접두사로 시작하는 모든 캐시를 무효화 */
  export function invalidateCacheByPrefix(prefix: string): void {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  }
  
  /** 전체 캐시 초기화 */
  export function clearAllCache(): void {
    store.clear();
  }