import type { Metadata } from "next";
import { We } from "@/components/SiteContact";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/queries";
import { getCustomer } from "@/lib/customer";
import { SITE } from "@/lib/site";
import {
  FB_OWNER_KEY,
  FB_POSTS_KEY,
  FB_PROFILE_KEY,
  parseFbPosts,
} from "@/lib/feedback";
import { GopYForm } from "@/components/gopy/GopYForm";
import { FeedbackWall, type WallItem } from "@/components/gopy/FeedbackWall";
import { Faq } from "@/components/gopy/Faq";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Góp ý & cộng đồng",
  description:
    "Gửi góp ý, báo lỗi hoặc đề xuất tính năng cho Tà Xùa Booking. Mọi góp ý đều được đọc và phản hồi.",
  alternates: { canonical: "/gop-y" },
};

function mins(d: Date, now: number): number {
  return Math.max(0, Math.round((now - d.getTime()) / 60000));
}

export default async function GopYPage() {
  const [settings, customer] = await Promise.all([getSettings(), getCustomer()]);
  const now = Date.now();

  const rows = await prisma.feedback.findMany({
    where: { hidden: false },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      _count: { select: { votes: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, authorName: true, content: true, isAdmin: true, createdAt: true },
      },
    },
  });

  const myVotes = customer
    ? new Set(
        (
          await prisma.feedbackVote.findMany({
            where: { customerId: customer.id },
            select: { feedbackId: true },
          })
        ).map((v) => v.feedbackId),
      )
    : new Set<string>();

  const items: WallItem[] = rows.map((f) => ({
    id: f.id,
    type: f.type,
    status: f.status,
    areas: f.areas,
    message: f.message,
    authorName: f.anon ? "Ẩn danh" : f.authorName,
    mine: Boolean(customer && f.customerId === customer.id),
    mins: mins(f.createdAt, now),
    mood: f.mood,
    votes: f._count.votes,
    voted: myVotes.has(f.id),
    reply: f.reply,
    pinned: f.pinned,
    comments: f.comments.map((c) => ({
      id: c.id,
      authorName: c.authorName,
      content: c.content,
      isAdmin: c.isAdmin,
      mins: mins(c.createdAt, now),
    })),
  }));

  // "Góp ý gần đây đã được làm" — suy từ các góp ý trạng thái Đã làm.
  const shipped = rows
    .filter((f) => f.status === "DONE")
    .slice(0, 3)
    .map((f) => {
      const d = f.updatedAt;
      return {
        id: f.id,
        t: f.message.length > 70 ? f.message.slice(0, 70).trim() + "…" : f.message,
        d: `Từ góp ý · ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`,
      };
    });

  const phone = settings.contactPhone || SITE.defaultPhone;
  const zalo = settings.contactZalo || SITE.defaultZalo;
  const email = settings.contactEmail;
  const fbProfile = settings[FB_PROFILE_KEY] || settings.contactFacebook || "";
  const fbOwner = settings[FB_OWNER_KEY] || "Chủ Tà Xùa Booking";
  const fbPosts = parseFbPosts(settings[FB_POSTS_KEY]);
  const showFb = Boolean(fbProfile) || fbPosts.length > 0;

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="bg-gradient-to-b from-forest-800 via-forest-600 to-cloud text-white">
        <div className="container-page flex flex-col gap-3 pb-24 pt-10 sm:pt-14">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-white/80">Góp ý &amp; cộng đồng</div>
          <h1 className="max-w-3xl text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Giúp Tà Xùa Booking tốt hơn mỗi chuyến đi
          </h1>
          <p className="max-w-2xl text-pretty text-[15px] leading-relaxed text-white/90 sm:text-base">
            Mỗi góp ý đều được đọc. Báo lỗi, đề xuất tính năng hay kể lại chuyến đi của bạn, <We /> sẽ phản hồi trong
            1–2 ngày làm việc.
          </p>
        </div>
      </section>

      <div className="container-page -mt-16 pb-16">
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Form */}
          <GopYForm loggedIn={Boolean(customer)} userName={customer?.name ?? ""} />

          {/* Sidebar */}
          <aside className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="text-base font-extrabold text-ink">Nói chuyện trực tiếp</div>
              {zalo && (
                <a
                  href={`https://zalo.me/${zalo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700"
                >
                  Nhắn Zalo <span>{zalo} →</span>
                </a>
              )}
              <a
                href={`tel:${phone.replace(/\s/g, "")}`}
                className="flex items-center justify-between rounded-2xl bg-forest-50 px-4 py-3 text-sm font-bold text-forest-700"
              >
                Gọi hotline <span>{phone} →</span>
              </a>
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center justify-between gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700"
                >
                  Email <span className="truncate">{email}</span>
                </a>
              )}
            </div>

            {shipped.length > 0 && (
              <div className="flex flex-col gap-2.5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <div className="text-base font-extrabold text-ink">Góp ý gần đây đã được làm</div>
                {shipped.map((x) => (
                  <div key={x.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-forest-500 text-[11px] font-bold text-white">
                      ✓
                    </span>
                    <div>
                      <div className="text-sm font-bold leading-snug text-ink">{x.t}</div>
                      <div className="text-xs text-gray-500">{x.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>

          {/* Bảng công khai (full width) */}
          <div className="lg:col-span-2">
            <FeedbackWall items={items} loggedIn={Boolean(customer)} />
          </div>

          {/* Facebook */}
          {showFb && (
            <section className="mt-4 flex flex-col gap-4 lg:col-span-2">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
                    Góp ý qua bài viết Facebook của mình
                  </h2>
                  <p className="mt-1 max-w-2xl text-pretty text-sm text-gray-500">
                    Mình đăng các bài xin ý kiến trên trang cá nhân. Bạn có thể bình luận trực tiếp dưới bài, mình đọc hết.
                  </p>
                </div>
                {fbProfile && (
                  <a
                    href={fbProfile}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    Xem trang cá nhân ↗
                  </a>
                )}
              </div>
              {fbPosts.length > 0 && (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {fbPosts.map((p, i) => (
                    <article key={i} className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
                      <div className="flex items-center gap-2.5 px-4 pb-2 pt-3.5">
                        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-forest-100 text-sm font-bold text-forest-700">
                          {fbOwner.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-extrabold text-ink">{fbOwner}</div>
                          <div className="text-xs text-gray-500">Trang cá nhân · {p.date}</div>
                        </div>
                        <span
                          className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold"
                          style={
                            p.open ? { background: "#fff3e0", color: "#c06a12" } : { background: "#e4f5ea", color: "#1b7a45" }
                          }
                        >
                          {p.open ? "Đang nhận góp ý" : "Đã tổng hợp"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5 px-4 pb-2.5">
                        {p.title && <div className="text-[15px] font-extrabold leading-snug text-ink">{p.title}</div>}
                        {p.text && <p className="line-clamp-3 text-sm leading-relaxed text-gray-600">{p.text}</p>}
                      </div>
                      {p.image && (
                        <div className="aspect-video bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.image} alt={p.title || "Bài viết"} className="h-full w-full object-cover" />
                        </div>
                      )}
                      {p.cmt && (
                        <div className="flex flex-col gap-1 bg-gray-50 px-4 py-2.5">
                          <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Bình luận nổi bật</div>
                          <div className="text-[13px] leading-snug text-gray-600">
                            <b>{p.cmtBy}:</b> {p.cmt}
                          </div>
                        </div>
                      )}
                      <div className="flex-1" />
                      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-3">
                        <span className="whitespace-nowrap text-xs font-semibold text-gray-500">{p.stats}</span>
                        {p.url && (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="whitespace-nowrap rounded-full bg-blue-50 px-3.5 py-2 text-[13px] font-bold text-blue-700 hover:bg-blue-100"
                          >
                            Bình luận góp ý ↗
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* FAQ */}
          <div className="lg:col-span-2">
            <Faq />
          </div>
        </div>
      </div>
    </div>
  );
}
