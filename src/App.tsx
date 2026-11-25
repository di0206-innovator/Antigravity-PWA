import { Component, Suspense, lazy, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Button } from './components/ui/Button';
import { PrivacyPage } from './pages/PrivacyPage';
import { SettingsPage } from './pages/SettingsPage';
import { SetupCenterPage } from './pages/SetupCenterPage';
import { HomePage } from './pages/HomePage';
import { useAppStore } from './stores/useAppStore';

const ActivityLogPage = lazy(() => import('./pages/ActivityLogPage').then((m) => ({ default: m.ActivityLogPage })));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })));
const PromptStudioPage = lazy(() => import('./pages/PromptStudioPage').then((m) => ({ default: m.PromptStudioPage })));
const SkillDeckPage = lazy(() => import('./pages/SkillDeckPage').then((m) => ({ default: m.SkillDeckPage })));
const TaskBoardPage = lazy(() => import('./pages/TaskBoardPage').then((m) => ({ default: m.TaskBoardPage })));
const WorkflowLibraryPage = lazy(() => import('./pages/WorkflowLibraryPage').then((m) => ({ default: m.WorkflowLibraryPage })));

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected interface error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-[100dvh] flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-primary)] p-4">
          <section className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
            <h1 className="text-xl font-semibold">Unable to render view</h1>
            <p className="text-sm text-[var(--text-secondary)]">{this.state.errorMessage}</p>
            <Button
              className="w-full"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                if (typeof window !== 'undefined') {
                  window.location.assign('/');
                }
              }}
            >
              Return to Home
            </Button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export function AppRoutes() {
  return (
    <AppShell>
      <Suspense fallback={<p className="p-6 text-sm text-[var(--text-secondary)]" role="status">Loading…</p>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/setup" element={<SetupCenterPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/prompts" element={<PromptStudioPage />} />
        <Route path="/skills" element={<SkillDeckPage />} />
        <Route path="/workflows" element={<WorkflowLibraryPage />} />
        <Route path="/tasks" element={<TaskBoardPage />} />
        <Route path="/activity" element={<ActivityLogPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </AppShell>
  );
}

export function App() {
  const initializeApp = useAppStore((s) => s.initializeApp);

  useEffect(() => {
    void initializeApp();
  }, [initializeApp]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
