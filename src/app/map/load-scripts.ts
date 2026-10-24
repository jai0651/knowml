/** Append classic <script> elements in order, waiting for each to load.
 *  `done` resolves true only if every script loaded and the page is still mounted. Returns a cleanup that removes them. Scripts are fresh on every mount, so
 *  page code that initialises at load time runs again after client-side
 *  navigation. `skipIf` names a global; if present the script is not reloaded. */
export function loadScripts(srcs: { src: string; skipIf?: string }[]) {
  const added: HTMLScriptElement[] = [];
  let cancelled = false;
  const done = (async () => {
    for (const { src, skipIf } of srcs) {
      if (cancelled) return false;
      if (skipIf && (window as unknown as Record<string, unknown>)[skipIf]) continue;
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = false;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`failed to load ${src}`));
        document.body.appendChild(s);
        added.push(s);
      });
    }
    return !cancelled;
  })();
  return {
    done,
    cleanup() {
      cancelled = true;
      added.forEach((s) => s.remove());
    },
  };
}
