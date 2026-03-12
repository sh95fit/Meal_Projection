/**
 * fetch 래퍼 — JSON 요청/응답 + 에러 처리를 통일
 */

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  
  export async function apiGet<T>(url: string): Promise<T> {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new ApiError(data.error || "요청에 실패했습니다.", res.status);
    return data as T;
  }
  
  export async function apiPost<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new ApiError(data.error || "요청에 실패했습니다.", res.status);
    return data as T;
  }
  
  export async function apiPut<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new ApiError(data.error || "요청에 실패했습니다.", res.status);
    return data as T;
  }
  
  export async function apiDelete<T>(url: string): Promise<T> {
    const res = await fetch(url, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new ApiError(data.error || "요청에 실패했습니다.", res.status);
    return data as T;
  }
  