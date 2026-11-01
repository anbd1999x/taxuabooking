/**
 * Skeleton cho các trang danh sách danh mục (homestay, xe cabin, combo...)
 * — hiện ngay khi điều hướng, tránh màn hình đứng im chờ server.
 */
export default function LoadingCategory() {
  return (
    <div style={{ background: "oklch(0.975 0.01 150)" }} className="min-h-screen">
      <div className="h-[280px] animate-pulse" style={{ background: "linear-gradient(180deg, oklch(0.4 0.04 220), oklch(0.8 0.04 150))" }} />
      <div className="container-page -mt-[60px] animate-pulse pb-24">
        <div className="h-[110px] rounded-[22px] bg-white/90 ring-1 ring-black/[0.06]" />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] sm:gap-[22px]">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-[22px] bg-white ring-1 ring-black/[0.06]">
              <div className="aspect-[4/3] bg-black/[0.07]" />
              <div className="flex flex-col gap-2.5 p-4">
                <div className="h-3.5 w-24 rounded-full bg-black/[0.06]" />
                <div className="h-5 w-[80%] rounded-full bg-black/[0.08]" />
                <div className="h-3.5 w-full rounded-full bg-black/[0.05]" />
                <div className="mt-1 h-6 w-28 rounded-full bg-black/[0.07]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
