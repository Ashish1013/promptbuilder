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
- **Database:** MongoDB (template sections and prompt drafts)
- **API pattern:** `/api/templates`, `/api/prompts`, `/api/prompts/compile`, `/api/roles`
- **Access control:** role header (`x-user-role`) with backend permission enforcement

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

## Prioritized Backlog
### P0 (Critical, next)
- Add optimistic autosave + unsaved-change guard when navigating away
- Add validation UI for required variables before save/export

### P1 (Important)
- Add side-by-side diff for raw template edits
- Add reusable snippet presets for common verticals
- Add richer metadata tagging (industry, campaign type, locale)

### P2 (Enhancement)
- Add prompt quality checklist scoring (deterministic rules)
- Add analytics dashboard for draft turnaround and reuse rate
- Add bulk export options (zip/combined formats)

## Next Tasks List
1. Implement required-variable validation and inline error markers in builder
2. Add autosave draft mode with last-saved indicator
3. Add quick-jump navigation by selected section in middle pane
4. Add template change history log for admin governance
5. Add downloadable markdown (`.md`) export in addition to JSON
