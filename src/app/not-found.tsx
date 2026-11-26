import { NotFoundView } from "@/components/NotFoundView";

/** 404 cho URL không khớp route nào (ngoài khu (site)): trang gọn, vẫn có link về các mục chính. */
export default function NotFound() {
  return (
    <main className="flex-1">
      <NotFoundView />
    </main>
  );
}
