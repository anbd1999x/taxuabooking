/**
 * Stub `next/headers` cho script kiểm thử gọi thẳng route handler (không có request thật):
 * cookie phiên lấy từ globalThis.__testCookies (đặt trong script).
 */
type Jar = Record<string, string>;
const jar = (): Jar => ((globalThis as unknown as { __testCookies?: Jar }).__testCookies ??= {});

export async function cookies() {
  return {
    get: (name: string) => (jar()[name] != null ? { name, value: jar()[name] } : undefined),
    set: (name: string, value: string) => {
      jar()[name] = value;
    },
    delete: (name: string) => {
      delete jar()[name];
    },
    has: (name: string) => jar()[name] != null,
    getAll: () => Object.entries(jar()).map(([name, value]) => ({ name, value })),
  };
}

export async function headers() {
  return new Headers();
}
