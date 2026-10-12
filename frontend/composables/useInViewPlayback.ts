/**
 * W5 perf: play a <video> only while it is on screen.
 *
 * - IntersectionObserver plays the video when at least 25% of it is visible
 *   and pauses it otherwise (off-screen cards cost nothing).
 * - Pauses while the tab is hidden.
 * - Never autoplays for `prefers-reduced-motion: reduce` users; they see the
 *   poster (still frame).
 *
 * The caller renders `<video muted loop playsinline preload="none" :poster>`;
 * with `preload="none"` nothing downloads until the first play.
 */
import { onBeforeUnmount, onMounted, watch, type Ref } from "vue";

export function useInViewPlayback(
  videoEl: Ref<HTMLVideoElement | null>,
  /** Extra gate, e.g. the "Animate task GIFs" setting. Re-checked reactively. */
  enabled: () => boolean = () => true
) {
  let observer: IntersectionObserver | null = null;
  let visible = false;

  const reducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function sync() {
    const el = videoEl.value;
    if (!el) return;
    const shouldPlay = enabled() && visible && !document.hidden && !reducedMotion();
    if (shouldPlay) {
      // play() rejects if interrupted (e.g. scrolled away again) — harmless.
      el.play().catch(() => {});
    } else if (!el.paused) {
      el.pause();
    }
  }

  function observe(el: HTMLVideoElement | null) {
    observer?.disconnect();
    if (!el || typeof IntersectionObserver === "undefined") return;
    observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        sync();
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
  }

  onMounted(() => {
    document.addEventListener("visibilitychange", sync);
    observe(videoEl.value);
  });

  // The element can appear later (e.g. when a GIF is added to the task).
  watch(videoEl, (el) => observe(el));
  watch(enabled, sync);

  onBeforeUnmount(() => {
    observer?.disconnect();
    document.removeEventListener("visibilitychange", sync);
  });
}
