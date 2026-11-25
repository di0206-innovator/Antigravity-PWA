import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import viteConfigRaw from '../../vite.config.ts?raw';
import offlineHtml from '../../public/offline.html?raw';
import faviconSvg from '../../public/favicon.svg?raw';

describe('PWA Configuration & Assets', () => {
  it('configures index.html with OLED theme-color, AG Pocket title, and iOS/mobile viewport meta tags', () => {
    expect(indexHtml).toContain('data-theme="dark"');
    expect(indexHtml).toContain('viewport-fit=cover');
    expect(indexHtml).toContain('interactive-widget=resizes-content');
    expect(indexHtml).toContain('<meta name="theme-color" content="#000000" />');
    expect(indexHtml).toContain('apple-mobile-web-app-capable');
    expect(indexHtml).toContain('black-translucent');
    expect(indexHtml).toContain('apple-mobile-web-app-title" content="AG Pocket"');
    expect(indexHtml).toContain('<title>AG Pocket — Antigravity Mobile Command Center</title>');
  });

  it('configures vite.config.ts with registerType prompt, exact manifest, and NetworkOnly Google/auth SW rules', () => {
    expect(viteConfigRaw).toContain("registerType: 'prompt'");
    expect(viteConfigRaw).toContain("name: 'AG Pocket — Antigravity Mobile Command Center'");
    expect(viteConfigRaw).toContain("short_name: 'AG Pocket'");
    expect(viteConfigRaw).toContain("display: 'standalone'");
    expect(viteConfigRaw).toContain("orientation: 'any'");
    expect(viteConfigRaw).toContain("start_url: '/'");
    expect(viteConfigRaw).toContain("scope: '/'");
    expect(viteConfigRaw).toContain('pwa-192x192.png');
    expect(viteConfigRaw).toContain('pwa-512x512.png');
    expect(viteConfigRaw).toContain('pwa-512x512-maskable.png');
    expect(viteConfigRaw).toContain("navigateFallback: '/index.html'");
    expect(viteConfigRaw).toContain('navigateFallbackDenylist');
    expect(viteConfigRaw).toContain("handler: 'NetworkOnly'");
    expect(viteConfigRaw).not.toContain('fonts.googleapis.com');
    expect(viteConfigRaw).not.toContain('CacheFirst');
  });

  it('provides CSP-safe offline.html and AG monogram favicon SVG', () => {
    expect(offlineHtml).toContain('You are offline');
    expect(offlineHtml).toContain('https://antigravity.google.com');
    expect(offlineHtml).not.toMatch(/<script\b/i);
    expect(faviconSvg).toContain('<svg');
    expect(faviconSvg).toContain('#3b82f6');
    expect(faviconSvg).toContain('#8b5cf6');
  });
});
