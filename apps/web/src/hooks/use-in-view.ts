import { useRef, useState, useEffect } from 'react';

export const useInView = <T extends HTMLElement = HTMLDivElement>(threshold = 0.1) => {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView, hydrated] as const;
};
