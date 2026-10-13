/**
 * W2 re-export of the breakpoint ref shape so V2 components have a single
 * import path. The actual provider lives in `composables/useBreakpoint.ts`
 * (mounted at `app.vue`); the campaign tree re-injects the same `Ref`s.
 *
 * Note: `BREAKPOINT_KEY` is auto-imported by Nuxt from
 * `composables/useBreakpoint.ts`; we do NOT re-export it here to avoid
 * the "Duplicated imports" warning Nuxt emits when the same export is
 * reachable from two auto-import paths.
 */
import { inject, type Ref } from "vue";

export interface BreakpointRefs {
  isPhone: Ref<boolean>;
  isTablet: Ref<boolean>;
  isDesktop: Ref<boolean>;
}

/**
 * Inject the W4b breakpoint refs. Falls back to a desktop-default shape
 * (matches `injectBreakpoints` in useBreakpoint.ts) so components can
 * mount under SSR or in a missing-provider preview without errors.
 */
export function injectCampaignBreakpoints(): BreakpointRefs {
  return inject<BreakpointRefs>("w4bBreakpoints", {
    isPhone: { value: false } as unknown as Ref<boolean>,
    isTablet: { value: false } as unknown as Ref<boolean>,
    isDesktop: { value: true } as unknown as Ref<boolean>,
  });
}
