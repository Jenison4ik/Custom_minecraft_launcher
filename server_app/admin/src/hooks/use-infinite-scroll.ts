import { useEffect, useRef } from "react";

export function useInfiniteScroll(
  enabled: boolean,
  onLoad: () => void,
  root: Element | null = null,
) {
  const ref = useRef<HTMLDivElement>(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadRef.current();
      },
      { root, rootMargin: "160px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, root]);

  return ref;
}
