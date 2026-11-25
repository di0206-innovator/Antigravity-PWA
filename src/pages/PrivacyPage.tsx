import { Link } from 'react-router-dom';
import { Database, Lock, ShieldCheck, WifiOff } from 'lucide-react';
import { officialIntegrationAdapter } from '../services/officialAdapter';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { DisclosureBanner } from '../components/ui/DisclosureBanner';

export function PrivacyPage() {
  const capabilities = officialIntegrationAdapter.getCapabilities();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Privacy &amp; Security Boundary</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          How AG Pocket stores personal data locally and enforces its official-first companion
          boundary around Google Antigravity.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-[var(--accent-primary)]" aria-hidden="true" />
            <CardTitle>100% Local IndexedDB Persistence</CardTitle>
          </div>
          <CardDescription>
            Database: <code>ag-pocket-db</code> (browser-local IndexedDB via Dexie).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm leading-relaxed text-[var(--text-secondary)]">
          <p>
            All projects, prompt templates, drafts, skill entries, workflows, personal tasks,
            activity history, and preferences stay exclusively inside your device&apos;s browser
            storage.
          </p>
          <p>
            AG Pocket has zero backend servers, zero cloud databases, zero third-party analytics,
            and zero background synchronization. You can export a JSON backup or clear all local
            data anytime from Settings.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[var(--accent-primary)]" aria-hidden="true" />
            <CardTitle>Official-First Security Boundary</CardTitle>
          </div>
          <CardDescription>
            AG Pocket is strictly a companion and launcher for{' '}
            <code>https://antigravity.google.com</code> and <code>https://antigravity.google/docs/*</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="list-disc list-inside space-y-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
            <li>
              Never extracts, stores, or reuses Google OAuth tokens, authentication cookies, or
              credentials.
            </li>
            <li>
              Never calls private Antigravity backend APIs, private language-server endpoints, or
              private WebSocket streams.
            </li>
            <li>
              Never scrapes the Antigravity DOM, injects remote debugging ports, wraps the
              Antigravity CLI, or embeds Antigravity in an iframe.
            </li>
            <li>
              Never submits prompts automatically, auto-approves desktop commands, exposes local
              network bridges, polls agents in the background, or fabricates live status.
            </li>
            <li>
              Validates all saved and launched official URLs (rejecting <code>http:</code>,{' '}
              <code>javascript:</code>, <code>data:</code>, embedded credentials, and non-official
              hosts) and renders user-controlled text strictly as plain text.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-[var(--accent-violet)]" aria-hidden="true" />
            <CardTitle>Service Worker Caching Exclusions</CardTitle>
          </div>
          <CardDescription>
            Strict network-only boundary for Google and authentication traffic.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          <p>
            The AG Pocket Service Worker precaches only AG Pocket&apos;s own static app shell and
            local assets (with an offline fallback page).
          </p>
          <p>
            Navigation fallbacks and runtime caches strictly exclude{' '}
            <code>antigravity.google.com</code>, <code>accounts.google.com</code>, all{' '}
            <code>*.google.com</code> domains, and <code>/auth</code>, <code>/oauth</code>,{' '}
            <code>/login</code>, <code>/signin</code>, <code>/session</code>, and{' '}
            <code>/token</code> paths (enforced as <code>NetworkOnly</code>).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-[var(--accent-violet)]" aria-hidden="true" />
              <CardTitle>Disabled Future Integration Adapter</CardTitle>
            </div>
            <Badge tone="neutral">enabled: {String(capabilities.enabled)}</Badge>
          </div>
          <CardDescription>
            Adapter ID: <code>{officialIntegrationAdapter.id}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <DisclosureBanner>{capabilities.reason}</DisclosureBanner>
          <p className="text-xs text-[var(--text-secondary)]">
            Permitted local actions: {capabilities.permittedActions.join(', ')}.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Link
              to="/settings"
              className="touch-target inline-flex items-center justify-center rounded-xl border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              Back to Settings
            </Link>
            <Link
              to="/setup"
              className="touch-target inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
            >
              Connection Setup Center
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
