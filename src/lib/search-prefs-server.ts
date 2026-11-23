import "server-only";
import { cookies } from "next/headers";
import { SEARCH_COOKIE, applySearchPrefs, parsePrefs } from "./search-prefs";

/** Server: searchParams + ngày / số khách khách đã tìm trước đó (xem `search-prefs.ts`). */
export async function withSearchPrefs(
  sp: Record<string, string | string[] | undefined>,
  peopleKey: string | null,
): Promise<Record<string, string | string[] | undefined>> {
  const jar = await cookies();
  return applySearchPrefs(sp, parsePrefs(jar.get(SEARCH_COOKIE)?.value), peopleKey);
}
