import posthog from "posthog-js";

let initialized = false;

export function initPostHog() {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!posthogKey || initialized || posthog.__loaded) {
    return posthog;
  }

  if (process.env.NODE_ENV === "production") {
    posthog.init(posthogKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      loaded: (posthog) => {
        if (process.env.NODE_ENV === "development") posthog.debug();
      },
    });
    initialized = true;
  }

  return posthog;
}

export function capturePostHogEvent(eventName: string, properties?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return;
  }

  initPostHog().capture(eventName, properties);
}

export { posthog };
export default posthog;