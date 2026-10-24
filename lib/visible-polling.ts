// Interval polling that pauses while the tab is hidden and refreshes once when it becomes
// visible again — background tabs make no requests.
// Returns a cleanup function for use in a useEffect.

export function startVisiblePolling(poll: () => void, intervalMs: number): () => void {
  let timer: number | null = null;

  const start = () => {
    if (timer === null) timer = window.setInterval(poll, intervalMs);
  };
  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
  };
  const handleVisibilityChange = () => {
    if (document.hidden) {
      stop();
    } else {
      poll();
      start();
    }
  };

  if (!document.hidden) start();
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    stop();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}
