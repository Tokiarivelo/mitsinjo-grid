// Seekable timeline (VIDEO_PLAN.md § 7): every animation is paused and driven by __seek(ms).
window.__duration = Number(document.body.dataset.duration || 3000);
window.__seek = (ms) => {
  for (const a of document.getAnimations()) {
    a.pause();
    a.currentTime = ms;
  }
};
// anim(el, keyframes, start ms, length ms) — fill both so a seek before/after shows the end states.
window.anim = (el, kf, start, len, easing = 'cubic-bezier(.22,1,.36,1)') =>
  (typeof el === 'string' ? document.querySelectorAll(el) : [el]).forEach((e) =>
    e.animate(kf, { delay: start, duration: len, easing, fill: 'both' })
  );
// One animation: slide-up + fade in over 380 ms, hold, fade out over the last 300 ms.
window.inOut = (el, start, len, dy = 24) => {
  const a = 380 / len,
    b = 1 - 300 / len;
  anim(
    el,
    [
      {
        opacity: 0,
        transform: `translateY(${dy}px)`,
        offset: 0,
        easing: 'cubic-bezier(.22,1.4,.36,1)',
      },
      { opacity: 1, transform: 'none', offset: a },
      { opacity: 1, transform: 'none', offset: b, easing: 'ease-in' },
      { opacity: 0, transform: 'none', offset: 1 },
    ],
    start,
    len,
    'linear'
  );
};
document.fonts.ready.then(() => {
  window.__ready = true;
});
