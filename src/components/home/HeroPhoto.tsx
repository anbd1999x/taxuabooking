/* Banner trang chủ dạng ẢNH THẬT (đồi hoa cánh bướm nhìn xuống ruộng bậc thang Tà Xùa).
   Ảnh zoom rất chậm cho có "hơi thở"; lớp phủ tối dần về phía chữ để chữ luôn đọc được. */
export function HeroPhoto() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-[oklch(0.3_0.05_160)]">
      <style>{`@keyframes heroPhotoZoom{from{transform:scale(1)}to{transform:scale(1.07)}}
@media (prefers-reduced-motion: reduce){.hero-photo-img{animation:none!important}}`}</style>
      <picture>
        <source media="(max-width: 759px)" srcSet="/hero-taxua-m.jpg?v=5" />
        <img
          src="/hero-taxua.jpg?v=5"
          alt="Biển mây và ruộng bậc thang nhìn từ núi Tà Xùa"
          fetchPriority="high"
          decoding="async"
          className="hero-photo-img absolute inset-x-0 bottom-0 h-[122%] w-full object-cover object-[58%_100%] min-[760px]:static min-[760px]:h-full min-[760px]:object-[50%_72%]"
          style={{ animation: "heroPhotoZoom 28s ease-in-out infinite alternate", transformOrigin: "60% 100%" }}
        />
      </picture>
      {/* màn rộng: tối bên trái (chỗ chữ) + tối dần xuống đáy (chỗ ô tìm kiếm đè lên) */}
      <div
        className="pointer-events-none absolute inset-0 max-[759px]:hidden"
        style={{ background: "linear-gradient(90deg, oklch(0.2 0.05 200 / .72) 0%, oklch(0.2 0.05 200 / .38) 42%, oklch(0.2 0.05 200 / 0) 68%), linear-gradient(180deg, oklch(0.2 0.05 220 / .34) 0%, oklch(0.2 0.05 220 / 0) 22%, oklch(0.18 0.05 180 / 0) 50%, oklch(0.16 0.045 170 / .7) 100%)" }}
      />
      {/* màn hẹp: giữ nửa trên của ảnh trong trẻo, nửa dưới tối dần cho chữ */}
      <div
        className="pointer-events-none absolute inset-0 min-[760px]:hidden"
        style={{ background: "linear-gradient(180deg, oklch(0.2 0.05 220 / .3) 0%, oklch(0.2 0.05 220 / 0) 16%, oklch(0.18 0.05 180 / .08) 38%, oklch(0.17 0.05 175 / .5) 60%, oklch(0.15 0.045 170 / .66) 100%)" }}
      />
    </div>
  );
}
