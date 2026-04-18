# ReachAll Prompt Automation Studio — PRD

## Original Problem Statement
ReachAll delivers voice AI agents as a managed service for business customers. To improve service team efficiency, the first internal automation goal is a semi-automated prompt-writing system where prompts are assembled from reusable sections/subsections with variable inputs, raw-edit capability, and fast final prompt generation.

## User Choices Captured
- Scope (v1): section library + variable mapping + compiled prompt output + raw text editor for section/subsection
- Users & access: internal teams with role-based access (admin/editor/viewer)
- Template model: global template library reused across customers
- Output: plain text + JSON export + copy/share-ready snippets
- AI in phase-1: deterministic only (no AI suggestions)

## Architecture Decisions
- **Frontend:** React + React Router + Shadcn UI + Framer Motion
- **Backend:** FastAPI
- **Database:** MongoDB (`prompt_templates`, `prompt_drafts`, `users`, `role_permissions`)
- **API pattern:** `/api/template-library`, `/api/prompts`, `/api/activity`, `/api/roles`, `/api/users`
- **Access control:** JWT auth + server-side permission matrix enforcement

## User Personas
- **Admin:** manages global section templates and subsection raw text
- **Editor:** creates/updates/deletes prompt drafts and compiles outputs
- **Viewer:** read-only access for review and governance visibility

## Core Requirements (Static)
- Finite prompt structure composed from reusable sections and optional subsections
- Variable placeholders mapped to editable inputs
- Raw text visible and editable per section/subsection
- Deterministic compile to final prompt text
- Role-aware UI and backend permission checks
- Export and sharing utilities for operational usage

## What Has Been Implemented
### 2026-03-13
- Built full multi-page internal app shell: **Builder**, **Template Library**, **Drafts**, **Role Access**
- Implemented global template APIs with seeded defaults (Agent Persona, Language Guidelines, Call Flow, Guardrails)
- Implemented deterministic compile engine with placeholder replacement and section snippet output
- Implemented draft CRUD in MongoDB with role-based restrictions and timestamps
- Refactored builder UX to true **three-pane workflow**: left library selection, middle configuration workspace, right live compiled preview/export
- Added library-side search and section/subsection selection controls synced to config + preview panes
- Implemented builder UX: variable forms, raw editors, and live deterministic prompt rendering
- Implemented exports: copy prompt, copy snippets (JSON), and JSON file download
- Implemented template management view with admin-only editing controls

### 2026-03-13 (Flow + Access Upgrade)
- Added **JWT login flow** with session persistence and `auth/me` validation
- Added post-login **Activity page** as step-1 landing (recent user activity + Start Building Prompt CTA)
- Reworked prompt-level metadata input into a **compact top header bar** (removed middle-pane metadata card)
- Added **resizable pane widths** with draggable handles and saved pane layout preferences
- Added **Team Users & Roles** page where admin can create internal users and assign roles
- Hardened backend authorization so prompt/template writes derive role and username from validated JWT (no client-header trust)

### 2026-03-13 (Template Structure Upgrade)
- Updated **Agent Persona** template to include mandatory inputs (Agent Name, Agent Role, Agent Objective), gender dropdown (female/male/neutral), and optional **Company Details** subsection
- Rebuilt **Language Detection & Consistency** template into configurable subsections: Supported Languages, Switching Between Languages, Unsupported Switch Handling, Switch Samples, and Allow Switch Back
- Added new variable input types in builder UI: `select`, `multiselect`, and `textarea` with deterministic compile compatibility
- Added required-field validation before save for selected sections/subsections
- Added template hydration logic so loaded drafts retain correct variable controls from latest template definitions

### 2026-04-18 (IA + Workflow Refactor)
- Refactored top-level product architecture to **Activity / Builder / Template Library / Settings**
- Activity page now renders a compact table of prompts created via builder and supports opening any draft
- Builder now starts with required setup flow: choose **READY** template → name prompt → open 3-pane builder
- Builder output pane now prioritizes single editable prompt text block with compact copy/download/reset actions
- Template Library now supports clone-from-existing workflow only (no scratch creation), template status management, section/subsection editing, variable type definition, and placeholder insertion into template text
- Settings now includes editable role-permission matrix with persistence, plus user creation and role assignment

### 2026-04-18 (Template Usability Upgrade)
- Added first-view **All Templates** overview grid before editing workflow
- Added collapsible section cards (collapsed by default) for cleaner navigation
- Added section sequence controls (move up/down) with save persistence of order
- Grouped variables under collapsible blocks (collapsed by default) at section and subsection levels
- Improved visual hierarchy with distinct color zones for section, subsection, variables, and option groups

## Prioritized Backlog
### P0 (Critical, next)
- Add optimistic autosave + unsaved-change guard when navigating away
- Add per-template validation mode toggle (strict vs flexible)

### P1 (Important)
- Add side-by-side diff for raw template edits
- Add reusable snippet presets for common verticals
- Add richer metadata tagging (industry, campaign type, locale)

### P2 (Enhancement)
- Add prompt quality checklist scoring (deterministic rules)
- Add analytics dashboard for draft turnaround and reuse rate
- Add bulk export options (zip/combined formats)

## Next Tasks List
1. Implement inline variable guidance markers (without hard mandatory blocking)
2. Add autosave draft mode with last-saved indicator
3. Add quick-jump navigation by selected section in middle pane
4. Add template change history log for admin governance
5. Add downloadable markdown (`.md`) export in addition to JSON
