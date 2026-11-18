/**
 * Skeleton hiện NGAY khi bấm vào trang chi tiết dịch vụ/phòng — tránh cảm giác
 * "click không ăn" trong lúc server dựng trang (query DB + tính tình trạng).
 */
export default function LoadingServiceDetail() {
  return (
    <div style={{ background: "oklch(0.975 0.01 150)" }} className="min-h-screen">
      <div className="container-page animate-pulse pb-24 pt-8">
        {/* breadcrumb */}
        <div className="h-4 w-56 rounded-full bg-black/[0.07]" />
        {/* tiêu đề */}
        <div className="mt-5 h-9 w-[min(560px,80%)] rounded-xl bg-black/[0.09]" />
        <div className="mt-3 h-4 w-40 rounded-full bg-black/[0.06]" />
        {/* gallery */}
        <div className="mt-6 grid gap-3 lg:grid-cols-[2fr_1fr]">
          <div className="aspect-[16/9] rounded-[22px] bg-black/[0.08]" />
          <div className="hidden flex-col gap-3 lg:flex">
            <div className="flex-1 rounded-[22px] bg-black/[0.06]" />
            <div className="flex-1 rounded-[22px] bg-black/[0.06]" />
          </div>
        </div>
        {/* nội dung + aside */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-4">
            <div className="h-5 w-44 rounded-full bg-black/[0.08]" />
            <div className="h-4 w-full rounded-full bg-black/[0.05]" />
            <div className="h-4 w-[92%] rounded-full bg-black/[0.05]" />
            <div className="h-4 w-[84%] rounded-full bg-black/[0.05]" />
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="h-40 rounded-[18px] bg-black/[0.06]" />
              <div className="h-40 rounded-[18px] bg-black/[0.06]" />
            </div>
          </div>
          <div className="h-[340px] rounded-[22px] bg-black/[0.07]" />
        </div>
      </div>
    </div>
  );
}
