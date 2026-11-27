import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckSquare,
  ExternalLink,
  GitBranch,
  Layers,
  Terminal,
  Waypoints,
} from 'lucide-react';
import { OFFICIAL_ANTIGRAVITY_BASE_URL, openOfficialUrl } from '../services/security';
import { logActivity } from '../db/activityService';
import './ParallaxHero.css';

interface FloatingChip {
  label: string;
  to: string;
  color: string;
  icon: typeof Terminal;
  rotate: string;
  slotClass: string;
}

const FEATURE_CHIPS: FloatingChip[] = [
  {
    label: 'Prompt Studio',
    to: '/prompts',
    color: '#A45BE8',
    icon: Terminal,
    rotate: '-2.5deg',
    slotClass: 'ph-chip--slot-1',
  },
  {
    label: 'Task Board',
    to: '/tasks',
    color: '#E94FD0',
    icon: CheckSquare,
    rotate: '2deg',
    slotClass: 'ph-chip--slot-2',
  },
  {
    label: 'Workflow Library',
    to: '/workflows',
    color: '#6095C8',
    icon: GitBranch,
    rotate: '-1.5deg',
    slotClass: 'ph-chip--slot-3',
  },
  {
    label: 'Skill Deck',
    to: '/skills',
    color: '#7D9F40',
    icon: Layers,
    rotate: '2.5deg',
    slotClass: 'ph-chip--slot-4',
  },
];

export interface ParallaxHeroProps {
  onOpenAntigravity?: () => void;
}

export default function ParallaxHero({ onOpenAntigravity }: ParallaxHeroProps) {
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
      if (rect.bottom > 0) setOffset(Math.min(window.scrollY * 0.28, 120));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reducedMotion]);

  const handlePrimaryClick = () => {
    if (onOpenAntigravity) {
      onOpenAntigravity();
      return;
    }
    const result = openOfficialUrl(OFFICIAL_ANTIGRAVITY_BASE_URL);
    if (result.opened) {
      void logActivity({
        category: 'setup',
        description: 'Opened official Antigravity Remote Control',
      }).catch(() => {});
    }
  };

  return (
    <section
      ref={heroRef}
      className="ph-hero"
      aria-label="AG Pocket — Antigravity Mobile Command Center"
    >
      {/* Clean landscape background */}
      <div
        className="ph-bg"
        style={{ transform: `translate3d(0, ${offset}px, 0)` }}
        aria-hidden="true"
      />

      {/* Restrained directional scrim for text legibility */}
      <div className="ph-overlay" aria-hidden="true" />

      {/* Main 2-column responsive hero grid */}
      <div className="ph-inner">
        {/* Left column: branding, single headline, supporting text, CTAs */}
        <div className="ph-main">
          <div className="ph-identity">
            <span className="ph-identity__dot" aria-hidden="true" />
            <span className="ph-identity__label">
              AG POCKET · Antigravity Mobile Command Center
            </span>
          </div>

          <h1 className="ph-headline">
            <span className="ph-headline__line">ANTIGRAVITY,</span>
            <span className="ph-headline__line ph-headline__line--accent">
              IN YOUR POCKET.
            </span>
          </h1>

          <p className="ph-sub">
            Your mobile command center. Craft prompts, manage projects and access your
            Antigravity workflows from anywhere.
          </p>

          <div className="ph-actions">
            <button
              type="button"
              onClick={handlePrimaryClick}
              className="ph-btn ph-btn--primary"
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Open Antigravity</span>
            </button>

            <Link to="/setup" className="ph-btn ph-btn--ghost">
              <Waypoints className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Setup Guide</span>
            </Link>
          </div>
        </div>

        {/* Right column: intentional floating cream feature tags + quick-launch card */}
        <div className="ph-aside">
          <nav className="ph-chips" aria-label="Quick feature shortcuts">
            {FEATURE_CHIPS.map((chip) => {
              const Icon = chip.icon;
              return (
                <Link
                  key={chip.label}
                  to={chip.to}
                  className={`ph-chip ${chip.slotClass}`}
                  style={{ '--chip-rotate': chip.rotate } as React.CSSProperties}
                >
                  <span
                    className="ph-chip__icon"
                    style={{ backgroundColor: chip.color }}
                    aria-hidden="true"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="ph-chip__text">{chip.label}</span>
                </Link>
              );
            })}
          </nav>

          <Link to="/prompts" className="ph-featured">
            <div className="ph-featured__inner">
              <span className="ph-featured__label">Quick Launch</span>
              <span className="ph-featured__title">
                Prompt Studio
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
