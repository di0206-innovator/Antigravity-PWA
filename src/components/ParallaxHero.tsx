import React, { useEffect, useRef, useState } from 'react';
import './ParallaxHero.css';

interface FloatingChip {
  label: string;
  color: string;
  icon: string;
  style: React.CSSProperties;
  rotate?: string;
}

const chips: FloatingChip[] = [
  {
    label: 'Prompt Studio',
    color: '#A45BE8',
    icon: '✦',
    style: { top: '22%', right: '14%' },
    rotate: '-2deg',
  },
  {
    label: 'Skill Deck',
    color: '#7D9F40',
    icon: '◈',
    style: { top: '38%', right: '8%' },
    rotate: '2deg',
  },
  {
    label: 'Workflow Library',
    color: '#6095C8',
    icon: '⬡',
    style: { top: '52%', left: '8%' },
    rotate: '-1deg',
  },
  {
    label: 'Task Board',
    color: '#E94FD0',
    icon: '◉',
    style: { top: '30%', left: '6%' },
    rotate: '3deg',
  },
];

export default function ParallaxHero() {
  const [offset, setOffset] = useState(0);
  const heroRef = useRef<HTMLElement>(null);
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reducedMotion) return;
    const onScroll = () => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      if (rect.bottom > 0) setOffset(window.scrollY * 0.35);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reducedMotion]);

  return (
    <section
      ref={heroRef}
      className="ph-hero"
      aria-label="AG Pocket — your personal command center for Antigravity"
    >
      {/* Parallax background */}
      <div
        className="ph-bg"
        style={{ transform: `translateY(${offset}px)` }}
        aria-hidden="true"
      />

      {/* Dark gradient overlay for text readability */}
      <div className="ph-overlay" aria-hidden="true" />

      {/* Floating identity chip — top left */}
      <div className="ph-identity" aria-hidden="true">
        <span className="ph-identity__dot" />
        <span className="ph-identity__label">AG Pocket · Command Center</span>
      </div>

      {/* Floating category chips */}
      {chips.map((chip) => (
        <div
          key={chip.label}
          className="ph-chip"
          style={{ ...chip.style, transform: `rotate(${chip.rotate ?? '0deg'})` }}
          aria-hidden="true"
        >
          <span className="ph-chip__icon" style={{ background: chip.color }}>
            {chip.icon}
          </span>
          <span className="ph-chip__text">{chip.label}</span>
        </div>
      ))}

      {/* Main editorial headline */}
      <div className="ph-content">
        <h1 className="ph-headline">
          <span className="ph-headline__line">Your</span>
          <span className="ph-headline__line ph-headline__line--accent">Command</span>
          <span className="ph-headline__line">Center.</span>
        </h1>
        <p className="ph-sub">
          Craft prompts, manage projects and launch Antigravity from anywhere.
        </p>
        <div className="ph-actions">
          <a
            href="https://antigravity.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="ph-btn ph-btn--primary"
          >
            Open Antigravity
          </a>
          <a href="#setup" className="ph-btn ph-btn--ghost">
            Setup guide
          </a>
        </div>
      </div>

      {/* Bottom desc — bottom-left editorial text */}
      <p className="ph-footnote" aria-hidden="true">
        — Everything you need, right in your pocket.
      </p>

      {/* Featured card — bottom-right */}
      <div className="ph-featured" aria-hidden="true">
        <div className="ph-featured__inner">
          <span className="ph-featured__label">Quick launch</span>
          <span className="ph-featured__title">Prompt Studio</span>
        </div>
      </div>
    </section>
  );
}
