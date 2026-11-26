import React, { useEffect, useState } from 'react';
import './ParallaxHero.css';

/**
 * ParallaxHero – a full‑screen hero section with a background image that moves
 * at a slower rate than the page scroll to create a depth effect. The component
 * is WCAG‑AA compliant: it provides a clear heading, sufficient colour contrast
 * (using design tokens), and respects `prefers-reduced-motion`.
 */
export default function ParallaxHero() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    // Respect users who prefer reduced motion – disable the scroll listener.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const onScroll = () => setOffset(window.scrollY * 0.4); // slower movement
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section
      className="parallax-hero"
      aria-label="AG Pocket welcome hero"
      role="region"
    >
      <div
        className="parallax-hero__bg"
        style={{ transform: `translateY(${offset}px)` }}
        aria-hidden="true"
      />
      <div className="parallax-hero__content">
        <h1 className="parallax-hero__title">AG Pocket</h1>
        <p className="parallax-hero__subtitle">
          Your mobile command centre for Google Antigravity – fast, secure, and
          always at hand.
        </p>
        <a
          className="parallax-hero__cta"
          href="https://antigravity.google.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Antigravity Remote
        </a>
      </div>
    </section>
  );
}

