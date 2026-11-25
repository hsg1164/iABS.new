import React, { useEffect, useRef, useState } from 'react';
import './Archive60.css';

type Props = { lang: 'ar' | 'en' };

/** Keep the archive identical to the supplied abs-sixty (1).html reference. */
export default function Archive60(_props: Props) {
  const [srcDoc, setSrcDoc] = useState('');
  const frameRef = useRef<HTMLIFrameElement>(null);

  const fitFrame = () => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc) return;
    // The mobile layout builds the award cards after the iframe's first paint.
    // Include the full document bounds so the cards cannot be clipped by the
    // iframe viewport while the page is still settling.
    const height = Math.max(
      doc.documentElement?.scrollHeight || 0,
      doc.documentElement?.offsetHeight || 0,
      doc.body?.scrollHeight || 0,
      doc.body?.offsetHeight || 0
    );
    if (height > 0) frame.style.height = `${height + 8}px`;
  };

  useEffect(() => {
    let active = true;
      fetch('/abs-sixty-section.html')
      .then((response) => response.text())
      .then((html) => {
        if (!active) return;
        setSrcDoc(html);
      })
      .catch(() => setSrcDoc(''));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onPortalNavigate = (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'abs60-navigate') return;
      const url = String(event.data.url || '/60day/index.html#wall');
      try { sessionStorage.setItem('abs60', '1'); } catch {}
      // Navigation happens first; the destination plays the portal on arrival.
      window.location.href = url;
    };
    window.addEventListener('message', onPortalNavigate);
    return () => window.removeEventListener('message', onPortalNavigate);
  }, []);

  return (
    <section id="archive60" className="archive60-reference" aria-label="أرشيف الستين يوم">
      <iframe
        ref={frameRef}
        title="أرشيف الستين يوم"
        srcDoc={srcDoc}
        loading="eager"
        scrolling="no"
        onLoad={() => {
          fitFrame();
          [100, 300, 700, 1200].forEach((delay) => window.setTimeout(fitFrame, delay));

          // Keep the frame in sync when the responsive award grid reflows.
          const doc = frameRef.current?.contentDocument;
          if (doc && typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(fitFrame);
            if (doc.documentElement) observer.observe(doc.documentElement);
            if (doc.body) observer.observe(doc.body);
            window.setTimeout(() => observer.disconnect(), 2500);
          }
        }}
      />
    </section>
  );
}
