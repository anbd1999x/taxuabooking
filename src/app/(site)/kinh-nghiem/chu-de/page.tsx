import { permanentRedirect } from "next/navigation";
import { lp } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/** /kinh-nghiem/chu-de (không có chủ đề) ⇒ trang danh sách mọi bài. */
export default async function TopicIndex() {
  permanentRedirect(await lp("/kinh-nghiem"));
}
