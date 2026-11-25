import type { PromptTemplate, SkillEntry, WorkflowEntry } from '../types/domain';
import { extractTemplateVariables } from '../services/security';
import {
  AGPocketDB,
  createDefaultAppSettings,
  createEmptyPromptDraft,
  db,
  withDbErrorHandling,
} from './database';

export const CURRENT_STARTER_SEED_VERSION = 1;

const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function buildPrompt(
  id: string,
  title: string,
  tags: string[],
  body: string
): PromptTemplate {
  return {
    id,
    title,
    body,
    tags,
    variables: extractTemplateVariables(body),
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

export const STARTER_PROMPT_TEMPLATES: readonly PromptTemplate[] = [
  buildPrompt(
    'starter-prompt-01',
    'Build a New Feature',
    ['feature', 'implementation', 'development'],
    `Project: {{project_name}}
Tech Stack: {{tech_stack}}
Skills to Apply: {{skills_to_use}}

Task:
Build the following feature cleanly into the existing codebase:
{{task_description}}

Requirements:
{{requirements}}

Constraints:
{{constraints}}

Deliverables:
1. Inspect existing patterns and interfaces before editing.
2. Implement the feature with clean types, error handling, and empty states.
3. Add unit/integration tests covering happy paths and edge cases.
4. Run build, typecheck, lint, and tests and summarize exact results.`
  ),
  buildPrompt(
    'starter-prompt-02',
    'Debug an Existing Issue',
    ['debug', 'root-cause', 'fix'],
    `Project: {{project_name}}
Tech Stack: {{tech_stack}}
Skills to Apply: {{skills_to_use}}

Issue Summary:
{{task_description}}

Observed vs Expected Behavior:
{{requirements}}

Constraints:
{{constraints}}

Instructions:
1. Reproduce the issue with a minimal test or diagnostic step first.
2. Trace the root cause across state, data flow, and edge conditions.
3. Apply the minimal, targeted fix without unrelated refactoring.
4. Add a regression test and verify typecheck, lint, and test suites pass.`
  ),
  buildPrompt(
    'starter-prompt-03',
    'Refactor Existing Code',
    ['refactor', 'architecture', 'cleanup'],
    `Project: {{project_name}}
Tech Stack: {{tech_stack}}
Skills to Apply: {{skills_to_use}}

Refactoring Goal:
{{task_description}}

Target Improvements:
{{requirements}}

Constraints:
{{constraints}}

Instructions:
1. Preserve public contracts and existing external behavior.
2. Simplify coupling, remove dead code, and clarify module boundaries.
3. Verify zero regressions with existing tests and add coverage for newly isolated units.`
  ),
  buildPrompt(
    'starter-prompt-04',
    'Audit a Codebase',
    ['audit', 'review', 'quality'],
    `Project: {{project_name}}
Tech Stack: {{tech_stack}}
Skills to Apply: {{skills_to_use}}

Audit Focus:
{{task_description}}

Checklist & Priorities:
{{requirements}}

Constraints:
{{constraints}}

Instructions:
1. Read the architecture, entry points, data layer, and security boundaries directly.
2. Report verified findings with exact file paths, line references, severity, and concrete fixes.
3. Flag any non-functional controls, missing error states, or test gaps.`
  ),
  buildPrompt(
    'starter-prompt-05',
    'Design a Mobile-First Interface',
    ['mobile', 'ui-ux', 'responsive'],
    `Project: {{project_name}}
Tech Stack: {{tech_stack}}
Skills to Apply: {{skills_to_use}}

Interface Scope:
{{task_description}}

UX & Accessibility Requirements:
{{requirements}}

Constraints:
{{constraints}}

Instructions:
1. Design for 320px–430px mobile viewports first, scaling cleanly to 768px–1440px.
2. Ensure >=44x44px touch targets, zero horizontal overflow, safe-area insets, visible focus rings, and keyboard-safe layouts.
3. Include clear loading, empty, and error states with WCAG AA contrast.`
  ),
  buildPrompt(
    'starter-prompt-06',
    'Implement a Backend Feature',
    ['backend', 'api', 'data'],
    `Project: {{project_name}}
Tech Stack: {{tech_stack}}
Skills to Apply: {{skills_to_use}}

Backend Feature:
{{task_description}}

API / Schema Requirements:
{{requirements}}

Constraints:
{{constraints}}

Instructions:
1. Validate all inputs at the boundary with strict schemas.
2. Design idempotent persistence/transactions and explicit error codes.
3. Cover authorization, validation failures, and concurrency edge cases with automated tests.`
  ),
  buildPrompt(
    'starter-prompt-07',
    'Perform a Security Review',
    ['security', 'hardening', 'owasp'],
    `Project: {{project_name}}
Tech Stack: {{tech_stack}}
Skills to Apply: {{skills_to_use}}

Security Scope:
{{task_description}}

Threat Surface & Requirements:
{{requirements}}

Constraints:
{{constraints}}

Instructions:
1. Audit URL validation, input sanitization, storage boundaries, headers/CSP, and auth assumptions.
2. Check for unsafe HTML injection, leaked secrets, open redirects, and unvalidated external data.
3. Document findings by severity and implement/verify defensive fixes.`
  ),
  buildPrompt(
    'starter-prompt-08',
    'Write and Execute Tests',
    ['testing', 'qa', 'verification'],
    `Project: {{project_name}}
Tech Stack: {{tech_stack}}
Skills to Apply: {{skills_to_use}}

Test Target:
{{task_description}}

Coverage & Scenarios:
{{requirements}}

Constraints:
{{constraints}}

Instructions:
1. Write behavior-focused tests covering normal flows, boundary values, empty/invalid inputs, and error recovery.
2. Avoid brittle implementation-detail assertions or mocked-out core logic.
3. Execute the full test suite and report exact pass/fail counts.`
  ),
  buildPrompt(
    'starter-prompt-09',
    'Research a Technical Problem',
    ['research', 'architecture', 'tradeoffs'],
    `Project: {{project_name}}
Tech Stack: {{tech_stack}}
Skills to Apply: {{skills_to_use}}

Research Question:
{{task_description}}

Evaluation Criteria:
{{requirements}}

Constraints:
{{constraints}}

Instructions:
1. Inspect local repo context and relevant specs before comparing options.
2. Present 2–3 concrete architectural approaches with pros, cons, risks, and compatibility notes.
3. Recommend one clear path forward with verifiable next steps.`
  ),
  buildPrompt(
    'starter-prompt-10',
    'Prepare an Implementation Plan',
    ['planning', 'milestones', 'architecture'],
    `Project: {{project_name}}
Tech Stack: {{tech_stack}}
Skills to Apply: {{skills_to_use}}

Goal:
{{task_description}}

Functional & Non-Functional Requirements:
{{requirements}}

Constraints:
{{constraints}}

Instructions:
1. Break work into ordered, independently verifiable milestones or steps.
2. Define exact file paths, interface contracts, data schemas, and edge cases.
3. Specify concrete verification commands and acceptance criteria for every phase.`
  ),
  buildPrompt(
    'starter-prompt-11',
    'Review Git Changes',
    ['git', 'code-review', 'diff'],
    `Project: {{project_name}}
Tech Stack: {{tech_stack}}
Skills to Apply: {{skills_to_use}}

Change Context:
{{task_description}}

Review Focus:
{{requirements}}

Constraints:
{{constraints}}

Instructions:
1. Inspect staged/unstaged diffs for correctness, regressions, edge cases, and security issues.
2. Check type safety, error handling, test coverage, and unintended side effects.
3. Summarize findings clearly with actionable file/line feedback.`
  ),
  buildPrompt(
    'starter-prompt-12',
    'Build a Complete Application in One Pass',
    ['fullstack', 'greenfield', 'end-to-end'],
    `Project: {{project_name}}
Tech Stack: {{tech_stack}}
Skills to Apply: {{skills_to_use}}

Application Vision:
{{task_description}}

Core Requirements & Modules:
{{requirements}}

Constraints & Security Boundaries:
{{constraints}}

Instructions:
1. Establish clean domain types, persistence schemas, and security boundaries first.
2. Build responsive, accessible UI modules with real local persistence and empty/error states.
3. Add comprehensive unit and E2E verification, documentation, and confirm typecheck, lint, test, and production build all pass.`
  ),
];

export const STARTER_SKILLS: readonly SkillEntry[] = [
  {
    id: 'starter-skill-01',
    name: 'Hallmark',
    category: 'Design',
    description:
      'High-craft UI design methodology focused on intentional typography, cohesive dark/light surfaces, crisp hierarchy, and non-generic visual polish.',
    instructions:
      'Use Hallmark when designing new screens or visual systems: define an intentional palette, restrain accents to purposeful focus/action points, enforce generous rhythm and readable typography, and avoid generic dashboard clutter.',
    samplePrompt:
      'Apply Hallmark design discipline to polish the mobile layout, spacing rhythm, typography hierarchy, and surface contrast across all primary cards and sheets.',
    tags: ['design', 'visual-craft', 'typography'],
    isFavorite: false,
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-skill-02',
    name: 'Teamwork',
    category: 'Agent Orchestration',
    description:
      'Structured multi-agent delegation, evidence-backed handoffs, scoped milestones, and independent verification workflows.',
    instructions:
      'Use Teamwork for complex multi-step engineering tasks: separate exploration, implementation, and verification; require exact file/line observations and verification commands in every handoff.',
    samplePrompt:
      'Use Teamwork methodology: inspect the target files first, write a verifiable step-by-step plan, implement minimal changes, and verify with build/lint/test commands.',
    tags: ['orchestration', 'handoff', 'verification'],
    isFavorite: false,
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-skill-03',
    name: 'Swarm',
    category: 'Agent Orchestration',
    description:
      'Parallel task decomposition across independent workstreams with clear interface contracts and conflict-free file ownership.',
    instructions:
      'Use Swarm when work can be parallelized across independent modules: lock shared interface contracts up front, assign disjoint file scopes to parallel workers, and run integrated verification after merge.',
    samplePrompt:
      'Decompose this work using Swarm principles into independent tracks with explicit interface contracts and zero overlapping file edits.',
    tags: ['parallel', 'swarm', 'contracts'],
    isFavorite: false,
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-skill-04',
    name: 'Red Antigravity Skills',
    category: 'AI Engineering',
    description:
      'Curated prompt engineering, adversarial testing, and safety-boundary techniques for Antigravity-assisted workflows.',
    instructions:
      'Use Red Antigravity Skills to stress-test agent assumptions, surface edge cases, validate strict architectural boundaries, and enforce evidence-based completion claims.',
    samplePrompt:
      'Apply Red Antigravity Skills to challenge edge cases, invalid inputs, offline transitions, and security boundaries in the current implementation.',
    tags: ['ai-engineering', 'adversarial', 'prompts'],
    isFavorite: false,
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-skill-05',
    name: 'Frontend Engineering',
    category: 'Frontend',
    description:
      'Modern React, TypeScript, state management, responsive CSS, and resilient client-side data flow best practices.',
    instructions:
      'Use Frontend Engineering for clean component composition, strict TypeScript contracts, predictable state updates, accessible forms, and zero-overflow responsive layouts.',
    samplePrompt:
      'Apply Frontend Engineering best practices: keep components focused, validate form inputs with Zod, handle loading/empty/error states, and verify responsive layout.',
    tags: ['react', 'typescript', 'pwa'],
    isFavorite: false,
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-skill-06',
    name: 'UI/UX Design',
    category: 'Design',
    description:
      'Mobile-first ergonomics, clear user journeys, >=44px touch targets, bottom-sheet interactions, and WCAG accessibility.',
    instructions:
      'Use UI/UX Design to prioritize thumb-zone ergonomics, progressive disclosure, clear primary vs secondary actions, visible focus states, and reduced-motion respect.',
    samplePrompt:
      'Review and refine the user flow for smartphone ergonomics, ensuring >=44px touch targets, clear empty states, and keyboard-safe bottom sheets.',
    tags: ['ux', 'accessibility', 'mobile-first'],
    isFavorite: false,
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-skill-07',
    name: 'Code Review',
    category: 'Productivity',
    description:
      'Systematic code quality inspection covering correctness, maintainability, type safety, error paths, and minimal diff discipline.',
    instructions:
      'Use Code Review before shipping changes: verify every changed function handles edge cases, avoids silent failures, preserves unrelated code, and stays strictly within scope.',
    samplePrompt:
      'Perform a thorough Code Review of the recent changes, focusing on edge cases, TypeScript strictness, error handling, and unnecessary complexity.',
    tags: ['review', 'quality', 'maintainability'],
    isFavorite: false,
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-skill-08',
    name: 'Testing and QA',
    category: 'Testing',
    description:
      'Behavior-driven unit, component, and Playwright E2E testing across mobile viewports, persistence, and offline scenarios.',
    instructions:
      'Use Testing and QA to write deterministic tests asserting observable user behavior, persistence across reloads, boundary inputs, and responsive viewport invariants.',
    samplePrompt:
      'Apply Testing and QA to add behavior-focused Vitest and Playwright coverage for persistence, error handling, and 320px–1440px responsive layout.',
    tags: ['vitest', 'playwright', 'qa'],
    isFavorite: false,
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-skill-09',
    name: 'Security Review',
    category: 'Security',
    description:
      'Defensive boundary review covering URL allowlists, XSS-safe rendering, zero secret leakage, CSP headers, and import validation.',
    instructions:
      'Use Security Review to verify all external URLs are allowlisted, user text is sanitized and rendered without unsafe HTML injection, and backup imports are strictly schema-validated.',
    samplePrompt:
      'Conduct a Security Review across URL validation, JSON import parsing, CSP headers, and service worker caching exclusions.',
    tags: ['security', 'csp', 'validation'],
    isFavorite: false,
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
];

export const STARTER_WORKFLOWS: readonly WorkflowEntry[] = [
  {
    id: 'starter-workflow-01',
    title: 'End-to-End Feature Delivery',
    description:
      'Structured workflow from scoping requirements and data contracts through implementation, testing, and verification.',
    category: 'Development',
    steps: [
      'Define the feature scope, domain types, and persistence schema changes.',
      'Compose an implementation prompt with exact constraints and target files.',
      'Implement the feature in Antigravity with unit/integration tests.',
      'Review diffs, run typecheck/lint/tests, and log completion notes.',
    ],
    relatedSkills: ['Teamwork', 'Code Review', 'Testing and QA'],
    copyablePrompt:
      'Implement {{task_description}} in {{project_name}} using {{tech_stack}}. Follow existing contracts, add tests for edge cases, and verify typecheck, lint, test, and build.',
    tags: ['development', 'delivery', 'testing'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-02',
    title: 'Mobile-First PWA UI Polish',
    description:
      'Audit and refine smartphone ergonomics, safe-area insets, accessibility, and zero-overflow responsive layouts.',
    category: 'Frontend',
    steps: [
      'Inspect screens across 320px, 375px, 390px, 430px, 768px, and 1440px widths.',
      'Verify >=44x44px touch targets, visible focus rings, and WCAG AA contrast.',
      'Test virtual keyboard behavior and bottom-sheet focus trapping on mobile.',
      'Confirm prefers-reduced-motion and light/dark theme parity.',
    ],
    relatedSkills: ['Hallmark', 'Frontend Engineering', 'UI/UX Design'],
    copyablePrompt:
      'Audit {{project_name}} UI for mobile-first ergonomics across 320px–1440px: check zero horizontal overflow, >=44px touch targets, safe-area padding, and accessible focus handling.',
    tags: ['frontend', 'mobile', 'a11y'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-03',
    title: 'Agentic Codebase Audit & Hardening',
    description:
      'Systematically verify security boundaries, input validation, error recovery, and test integrity across the repository.',
    category: 'AI Engineering',
    steps: [
      'Inspect external URL validation, sanitization, and backup schema checks.',
      'Verify zero forbidden network calls, credential storage, or unsafe DOM APIs.',
      'Exercise corrupt inputs, offline fallback, and storage error paths.',
      'Document verified findings and patch any uncovered edge cases.',
    ],
    relatedSkills: ['Red Antigravity Skills', 'Security Review', 'Code Review'],
    copyablePrompt:
      'Perform an adversarial security and reliability audit of {{project_name}}. Verify strict input validation, zero unsafe rendering, and resilient error handling.',
    tags: ['ai-engineering', 'audit', 'security'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-04',
    title: 'Prompt & Skill Orchestration Loop',
    description:
      'Combine Skill Deck instructions with Prompt Studio variables before launching official Antigravity Remote Control.',
    category: 'AI Engineering',
    steps: [
      'Select or customize a skill entry in Skill Deck and send it to Prompt Studio.',
      'Pick a Prompt Studio template and fill {{project_name}}, {{task_description}}, and {{constraints}}.',
      'Review the complete interpolated prompt preview and copy it locally.',
      'Open https://antigravity.google.com via the explicit launcher to paste and steer your session.',
    ],
    relatedSkills: ['Teamwork', 'Swarm', 'Red Antigravity Skills'],
    copyablePrompt:
      'Prepare a structured Antigravity prompt for {{project_name}} combining {{skills_to_use}} to accomplish {{task_description}} within {{constraints}}.',
    tags: ['prompts', 'skills', 'remote-control'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-05',
    title: 'Pre-Release Verification & Vercel Ship',
    description:
      'Run the full static, unit, E2E, PWA manifest/SW, and production build checklist before deploying to Vercel.',
    category: 'Release Engineering',
    steps: [
      'Run tsc --noEmit, ESLint, Vitest unit tests, and Playwright mobile/offline E2E tests.',
      'Run vite build and inspect dist/ manifest.webmanifest, icons, and service worker.',
      'Export a fresh JSON backup of local AG Pocket data before upgrades.',
      'Verify vercel.json SPA rewrites and security headers on preview deployment.',
    ],
    relatedSkills: ['Testing and QA', 'Security Review', 'Frontend Engineering'],
    copyablePrompt:
      'Execute the pre-release verification checklist for {{project_name}}: run typecheck, lint, unit tests, Playwright E2E, and production vite build.',
    tags: ['release', 'pwa', 'vercel'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-06',
    title: 'Start a New Project',
    description: 'Scaffold a new project with a clear architecture and tooling.',
    category: 'Development',
    steps: ['Describe the product goal, users and constraints.', 'Choose the stack and folder structure.', 'Ask Antigravity to scaffold, install and run the project.', 'Verify the app builds and runs, then commit a baseline.'],
    relatedSkills: ['Frontend Engineering', 'Code Review'],
    copyablePrompt: 'Start a new project called {{project_name}}. Goal: {{task_description}}. Stack: {{tech_stack}}. Scaffold the project, install dependencies, and confirm it builds and runs.',
    tags: ['project', 'scaffold'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-07',
    title: 'Refactor a Codebase',
    description: 'Improve structure without changing behaviour.',
    category: 'Development',
    steps: ['Identify the target modules and the behaviour that must stay identical.', 'Ensure tests cover current behaviour first.', 'Refactor in small steps, running tests after each.', 'Review the final diff for unintended changes.'],
    relatedSkills: ['Code Review', 'Testing and QA'],
    copyablePrompt: 'Refactor {{project_name}} focusing on {{task_description}}. Preserve behaviour, add tests where missing, and keep changes in small reviewable steps. Constraints: {{constraints}}.',
    tags: ['refactor'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-08',
    title: 'Debug a Production Issue',
    description: 'Systematic root-cause analysis for a live bug.',
    category: 'Development',
    steps: ['Capture symptoms, logs and reproduction steps.', 'Form hypotheses and rank by likelihood.', 'Reproduce locally and write a failing test.', 'Fix, verify, and document the root cause.'],
    relatedSkills: ['Testing and QA'],
    copyablePrompt: 'Debug this issue in {{project_name}}: {{task_description}}. Reproduce it, find the root cause, write a failing test, then fix it. Report the cause and the fix.',
    tags: ['debug', 'incident'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-09',
    title: 'Review an Implementation',
    description: 'Structured review of a change set for correctness and quality.',
    category: 'Development',
    steps: ['Collect the diff or files to review.', 'Check correctness, edge cases and error handling.', 'Check security, performance and accessibility.', 'Summarise findings by severity.'],
    relatedSkills: ['Code Review', 'Security Review'],
    copyablePrompt: 'Review the recent changes in {{project_name}}. Prioritise correctness, security and maintainability. List findings by severity with suggested fixes.',
    tags: ['review'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-10',
    title: 'Build a Responsive Landing Page',
    description: 'Design and build a mobile-first landing page.',
    category: 'Frontend',
    steps: ['Define audience, message and sections.', 'Design the layout mobile-first.', 'Implement with semantic HTML and responsive CSS.', 'Test at 320px to 1440px widths.'],
    relatedSkills: ['Hallmark', 'UI/UX Design', 'Frontend Engineering'],
    copyablePrompt: 'Build a responsive, mobile-first landing page for {{project_name}}. Requirements: {{requirements}}. Verify at 320, 375, 768 and 1440px widths.',
    tags: ['landing', 'responsive'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-11',
    title: 'Improve Accessibility',
    description: 'Audit and fix accessibility issues to practical WCAG AA.',
    category: 'Frontend',
    steps: ['Run automated checks and a keyboard-only pass.', 'Fix labels, roles, focus order and contrast.', 'Verify with a screen reader where possible.', 'Document remaining gaps.'],
    relatedSkills: ['UI/UX Design', 'Testing and QA'],
    copyablePrompt: 'Audit {{project_name}} for accessibility (WCAG 2.1 AA): keyboard navigation, labels, focus, contrast, reduced motion. Fix the issues and list any remaining gaps.',
    tags: ['a11y'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-12',
    title: 'Create a Design System',
    description: 'Establish tokens and reusable components.',
    category: 'Frontend',
    steps: ['Define colour, type, spacing and radius tokens.', 'Build core components with states.', 'Document usage and add visual tests.', 'Migrate existing screens.'],
    relatedSkills: ['Hallmark', 'UI/UX Design'],
    copyablePrompt: 'Create a design system for {{project_name}}: tokens, core components with all states, dark and light themes, and usage docs. Stack: {{tech_stack}}.',
    tags: ['design-system'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-13',
    title: 'Audit Mobile Responsiveness',
    description: 'Find layout and touch problems on small screens.',
    category: 'Frontend',
    steps: ['Test at 320, 360, 390 and 430px in portrait and landscape.', 'Check horizontal overflow and tap target size.', 'Check keyboard and safe-area behaviour.', 'Fix and re-verify.'],
    relatedSkills: ['Frontend Engineering', 'UI/UX Design'],
    copyablePrompt: 'Audit the mobile responsiveness of {{project_name}} at 320, 360, 390, 430, 768 and 1024px, portrait and landscape. Report and fix overflow, tiny touch targets and keyboard issues.',
    tags: ['mobile', 'responsive'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-14',
    title: 'Optimise Performance',
    description: 'Reduce load time and runtime cost.',
    category: 'Frontend',
    steps: ['Measure bundle size and Core Web Vitals.', 'Lazy-load non-critical routes and assets.', 'Remove unused dependencies.', 'Re-measure and record the improvement.'],
    relatedSkills: ['Frontend Engineering'],
    copyablePrompt: 'Optimise the performance of {{project_name}}: measure first, then reduce bundle size, lazy-load routes, and prevent layout shift. Report before and after numbers.',
    tags: ['performance'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-15',
    title: 'Build an AI Agent',
    description: 'Design a tool-using agent with clear boundaries.',
    category: 'AI Engineering',
    steps: ['Define the agent\'s goal, tools and limits.', 'Design the loop, memory and error handling.', 'Implement with logging and guardrails.', 'Evaluate on realistic tasks.'],
    relatedSkills: ['Agent Orchestration'],
    copyablePrompt: 'Design and build an AI agent for {{task_description}} in {{project_name}}. Define tools, loop, guardrails and an evaluation plan. Constraints: {{constraints}}.',
    tags: ['agent', 'llm'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-16',
    title: 'Implement RAG',
    description: 'Add retrieval-augmented generation over your documents.',
    category: 'AI Engineering',
    steps: ['Choose sources, chunking and embeddings.', 'Build indexing and retrieval.', 'Compose grounded prompts with citations.', 'Evaluate retrieval quality.'],
    relatedSkills: ['Backend Engineering'],
    copyablePrompt: 'Implement retrieval-augmented generation for {{project_name}} over {{task_description}}. Cover chunking, embeddings, retrieval, grounded answers with citations, and evaluation.',
    tags: ['rag'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-17',
    title: 'Create a Multi-Agent Architecture',
    description: 'Split work across coordinated agents.',
    category: 'AI Engineering',
    steps: ['Identify independent work streams.', 'Assign file ownership to avoid conflicts.', 'Define the coordinator\'s integration role.', 'Run, merge and verify.'],
    relatedSkills: ['Teamwork', 'Swarm'],
    copyablePrompt: 'Design a multi-agent plan for {{task_description}} in {{project_name}}. Assign each agent distinct files, define the coordinator\'s integration and verification steps.',
    tags: ['multi-agent'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-18',
    title: 'Integrate an External API',
    description: 'Integrate a third-party API safely.',
    category: 'AI Engineering',
    steps: ['Read the official API documentation.', 'Define typed client, auth handling and error handling.', 'Add retries and rate limiting where appropriate.', 'Test with mocked responses.'],
    relatedSkills: ['Backend Engineering', 'Security Review'],
    copyablePrompt: 'Integrate the external API described here: {{task_description}} into {{project_name}}. Use only documented endpoints, keep secrets out of client code, and add tests with mocks.',
    tags: ['api', 'integration'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-19',
    title: 'Evaluate Model Output',
    description: 'Build a repeatable evaluation for model quality.',
    category: 'AI Engineering',
    steps: ['Define success criteria and test cases.', 'Create a scoring rubric or automated checks.', 'Run on several prompt variants.', 'Compare and record results.'],
    relatedSkills: ['Testing and QA'],
    copyablePrompt: 'Create an evaluation for {{task_description}}: test cases, scoring rubric, and a comparison across prompt variants for {{project_name}}.',
    tags: ['evals'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-20',
    title: 'Run Test Suites',
    description: 'Run and triage the complete test suite.',
    category: 'Release Engineering',
    steps: ['Run type checking and linting.', 'Run unit tests.', 'Run browser end-to-end tests.', 'Triage and fix failures.'],
    relatedSkills: ['Testing and QA'],
    copyablePrompt: 'Run the full test suite for {{project_name}} (typecheck, lint, unit, end-to-end). Fix failures and report results honestly.',
    tags: ['tests'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-21',
    title: 'Prepare a Production Build',
    description: 'Produce and inspect a production build.',
    category: 'Release Engineering',
    steps: ['Run a clean install and build.', 'Inspect bundle size and warnings.', 'Verify manifest, icons and service worker.', 'Smoke-test the preview server.'],
    relatedSkills: ['Frontend Engineering'],
    copyablePrompt: 'Prepare a production build of {{project_name}}: clean install, build, inspect bundle and PWA assets, and smoke-test the preview.',
    tags: ['build'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-22',
    title: 'Review Environment Configuration',
    description: 'Check environment variables and secrets handling.',
    category: 'Release Engineering',
    steps: ['List required environment variables.', 'Confirm no secrets are committed or exposed to the client.', 'Check production vs development settings.', 'Document the configuration.'],
    relatedSkills: ['Security Review'],
    copyablePrompt: 'Review the environment configuration of {{project_name}}: required variables, secret handling, and production settings. Flag anything unsafe.',
    tags: ['env', 'config'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'starter-workflow-23',
    title: 'Validate Deployment Readiness',
    description: 'Final go/no-go checklist before shipping.',
    category: 'Release Engineering',
    steps: ['Confirm tests and build pass.', 'Verify headers, HTTPS and rewrites.', 'Test install and offline behaviour.', 'Prepare a rollback plan.'],
    relatedSkills: ['Testing and QA', 'Security Review'],
    copyablePrompt: 'Validate deployment readiness of {{project_name}}: tests, build, headers, HTTPS, offline behaviour and a rollback plan. Give a go or no-go with reasons.',
    tags: ['deploy'],
    isStarter: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
];

/**
 * Idempotently seeds starter prompts, skills, workflows, default settings, and active draft
 * on first run only. Once settings.starterSeededVersion >= CURRENT_STARTER_SEED_VERSION,
 * deleted starter entries are never resurrected on subsequent runs.
 */
export async function ensureSeeded(
  targetDb: AGPocketDB = db
): Promise<{ seeded: boolean; version: number }> {
  return withDbErrorHandling('Initialize local database', async () => {
    return targetDb.transaction(
      'rw',
      [
        targetDb.settings,
        targetDb.prompts,
        targetDb.skills,
        targetDb.workflows,
        targetDb.promptDrafts,
      ],
      async () => {
        const now = new Date().toISOString();
        const existingSettings = await targetDb.settings.get('default');

        if (
          existingSettings &&
          existingSettings.starterSeededVersion >= CURRENT_STARTER_SEED_VERSION
        ) {
          const existingDraft = await targetDb.promptDrafts.get('active');
          if (!existingDraft) {
            await targetDb.promptDrafts.put(createEmptyPromptDraft(now));
          }
          return {
            seeded: false,
            version: existingSettings.starterSeededVersion,
          };
        }

        const existingPromptIds = new Set(
          (await targetDb.prompts.toCollection().primaryKeys()).map(String)
        );
        const missingPrompts = STARTER_PROMPT_TEMPLATES.filter(
          (item) => !existingPromptIds.has(item.id)
        ).map((item) => ({ ...item, tags: [...item.tags], variables: [...item.variables] }));
        if (missingPrompts.length > 0) {
          await targetDb.prompts.bulkAdd(missingPrompts);
        }

        const existingSkillIds = new Set(
          (await targetDb.skills.toCollection().primaryKeys()).map(String)
        );
        const missingSkills = STARTER_SKILLS.filter(
          (item) => !existingSkillIds.has(item.id)
        ).map((item) => ({ ...item, tags: [...item.tags] }));
        if (missingSkills.length > 0) {
          await targetDb.skills.bulkAdd(missingSkills);
        }

        const existingWorkflowIds = new Set(
          (await targetDb.workflows.toCollection().primaryKeys()).map(String)
        );
        const missingWorkflows = STARTER_WORKFLOWS.filter(
          (item) => !existingWorkflowIds.has(item.id)
        ).map((item) => ({
          ...item,
          steps: [...item.steps],
          relatedSkills: [...item.relatedSkills],
          tags: [...item.tags],
        }));
        if (missingWorkflows.length > 0) {
          await targetDb.workflows.bulkAdd(missingWorkflows);
        }

        const existingDraft = await targetDb.promptDrafts.get('active');
        if (!existingDraft) {
          await targetDb.promptDrafts.put(createEmptyPromptDraft(now));
        }

        const nextSettings = existingSettings
          ? {
              ...existingSettings,
              starterSeededVersion: CURRENT_STARTER_SEED_VERSION,
              updatedAt: now,
            }
          : createDefaultAppSettings(now, CURRENT_STARTER_SEED_VERSION);

        await targetDb.settings.put(nextSettings);

        return {
          seeded: true,
          version: CURRENT_STARTER_SEED_VERSION,
        };
      }
    );
  });
}
