import posthog from "posthog-js";

let initialized = false;

export function initPostHog() {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!posthogKey || initialized || posthog.__loaded) {
    return posthog;
  }

  posthog.init(posthogKey);
  initialized = true;

  return posthog;
}

export function capturePostHogEvent(eventName: string) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return;
  }

  initPostHog().capture(eventName);
}

export { posthog };
export default posthog;