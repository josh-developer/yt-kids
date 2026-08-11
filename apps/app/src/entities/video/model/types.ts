/**
 * Re-exported, not redefined. The shipped catalog in `@repo/catalog` is typed by
 * these, and a package cannot depend on the app that consumes it, so the types
 * live there and the entity stays the app's way in — every `@/entities/video`
 * import is unaffected and there is still exactly one definition.
 */
export type { Video, VideoSource } from "@repo/catalog/types";
