/**
 * Reactive breakpoint state (W4b additions, B-S2).
 *
 * Single source of truth for `isPhone` (< 640 px) / `isTablet` (640-1023)
 * / `isDesktop` (>= 1024 px) within the FE shell. SSR-safe: returns the
 * desktop defaults on the server (so the markup matches what `>= lg`
 * users see) and snaps to the real viewport width on the client.
 *
 * `app.vue` calls this once at the page root and passes the result down
 * via props so every component stays pure. The `provide/inject` shorthand
 * is provided for deep descendants that don't want a prop chain.
 */
import { ref, onMounted, onBeforeUnmount, computed, provide, inject } from "vue";

export function useBreakpoint() {
  // Start at the desktop default on BOTH server and client so the first
  // client render matches the SSR markup; snap to the real width on mount.
  const width = ref(1280);

  function onResize() {
    width.value = window.innerWidth;
  }

  onMounted(() => {
    width.value = window.innerWidth;
    window.addEventListener("resize", onResize);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("resize", onResize);
  });

  const isPhone = computed(() => width.value < 640);
  const isTablet = computed(() => width.value >= 640 && width.value < 1024);
  const isDesktop = computed(() => width.value >= 1024);

  return { width, isPhone, isTablet, isDesktop };
}

export const BREAKPOINT_KEY = "w4bBreakpoints";

export function provideBreakpoints() {
  const bp = useBreakpoint();
  // Pass the ref directly so consumers re-render when the viewport
  // crosses a breakpoint. Vue's inject+template unwrapping handles the
  // .value access transparently.
  provide(BREAKPOINT_KEY, { isPhone: bp.isPhone, isTablet: bp.isTablet, isDesktop: bp.isDesktop });
  return bp;
}

export function injectBreakpoints() {
  // Falls back to a desktop-default ref so SSR markup matches `>= lg`.
  return inject<{
    isPhone: import("vue").Ref<boolean>;
    isTablet: import("vue").Ref<boolean>;
    isDesktop: import("vue").Ref<boolean>;
  }>(BREAKPOINT_KEY, {
    isPhone: ref(false),
    isTablet: ref(false),
    isDesktop: ref(true),
  });
}