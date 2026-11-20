/** CSS trạng thái ban đầu + đã hiện của các phần tử cuộn-tới-mới-hiện. */
export const REVEAL_CSS = `
[data-rv]{opacity:0;transform:translateY(40px);transition:opacity .9s var(--d,0s),transform .9s cubic-bezier(.2,.7,.2,1) var(--d,0s)}
[data-rv].is-in{opacity:1;transform:none}
[data-clip]{clip-path:inset(0 0 100% 0);transition:clip-path 1.1s cubic-bezier(.7,0,.2,1) var(--d,0s)}
[data-clip][data-clip-up]{clip-path:inset(100% 0 0 0)}
[data-clip].is-in{clip-path:inset(0 0 0 0)}
@keyframes twinkle{0%,100%{opacity:.25}50%{opacity:1}}
[data-tw]{animation:twinkle var(--tw,3s) ease-in-out infinite}
@media (prefers-reduced-motion: reduce){[data-rv],[data-clip]{opacity:1!important;transform:none!important;clip-path:none!important;transition:none!important}[data-tw]{animation:none;opacity:.7}}
`;
