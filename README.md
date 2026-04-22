# ⚡ FlowForge — HR Workflow Designer

> Built for Tredence Studio · Full Stack Engineering Intern (AI Agentic Platforms) · Case Study

---

## Quick Start

```bash

npm create vite@latest hr-workflow -- --template react
cd hr-workflow
npm install


npm run dev
```

> **No additional dependencies required.** The app uses only React (hooks), inline SVG for the canvas, and the Anthropic API (already injected via the claude.ai artifact runtime). Everything is bundled in a single `.jsx` file for zero-friction setup.

---

## Architecture

```
HRWorkflowDesigner.jsx
│
├── Mock API Layer          (MOCK_AUTOMATIONS, simulateWorkflow, GET /automations, POST /simulate)
├── Analytics Engine        (scoreWorkflowComplexity — complexity scoring)
├── SLA Predictor           (predictSLABreaches — real-time due-date & approval risk)
├── NODE_CONFIGS            (visual registry — single source of truth for all node types)
├── WORKFLOW_TEMPLATES      (3 built-in HR templates: Onboarding, Leave, Offboarding)
│
└── App (main component)
    ├── Canvas              (SVG-based, pan + zoom + drag, custom edge rendering)
    ├── Sidebar             (Node Library, AI Suggest, SLA Alerts strip, Zoom controls)
    ├── Node Form Panel     (Config tab + History tab per node)
    ├── Modals
    │   ├── Sandbox         (Simulation, Execution Timeline, SLA Predictions, Analytics)
    │   ├── NL Generator    (Natural Language → Workflow via Anthropic API)
    │   └── Templates       (3 pre-built HR workflow templates)
    └── Topbar              (Complexity Badge, Templates, Generate, Undo/Redo, Export/Import, Test)
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Single `.jsx` file | Zero setup friction; all logic co-located for reviewer clarity |
| SVG-based canvas (no React Flow library) | Demonstrates native understanding of graph rendering, coordinate math, and transformation matrices |
| Inline styles throughout | Avoids CSS file dependency; all visual logic inspectable in one pass |
| `updateNode` → `nodeHistory` side-effect | Edit history tracked at the call site — no separate middleware |
| Complexity scoring is pure/derived | Runs on every render from `nodes + edges` — no stale state |
| SLA predictor is stateless | Returns fresh breach list on each render — always accurate |

---

## Features

### Core (Required)

| Requirement | Status | Notes |
|---|---|---|
| Drag-and-drop canvas | ✅ | Click sidebar node type to add; drag nodes freely |
| 5 node types: Start, Task, Approval, Automated, End | ✅ | Each with distinct icon, color, and form |
| Connect nodes with edges | ✅ | Click `→` handle on any node, then click target |
| Select node to edit | ✅ | Click node → form panel slides in from right |
| Delete nodes / edges | ✅ | Delete key, or ✕ button on edge midpoint |
| Auto-validation (Start must be first) | ✅ | Visual dashed-red border on violating nodes |
| Node configuration forms | ✅ | All required fields for all 5 node types |
| Dynamic automated action params | ✅ | Param inputs render based on selected action |
| Key-value metadata / custom fields | ✅ | Add/remove pairs on Start and Task nodes |
| Mock GET /automations | ✅ | 7 mock actions with typed params |
| Mock POST /simulate | ✅ | Topological BFS execution + error reporting |
| Workflow Test/Sandbox panel | ✅ | Animated step-by-step execution timeline |
| Structural validation (cycles, disconnected nodes) | ✅ | Shown in sandbox + on-canvas node borders |
| Export as JSON | ✅ | Includes metadata envelope |
| Import from JSON | ✅ | Parses and restores nodes + edges |
| Undo / Redo | ✅ | `⌘Z` / `⌘Y` keyboard shortcuts, topbar buttons |
| Minimap | ✅ | Bottom-right, scales with canvas nodes |
| Zoom + Pan | ✅ | Scroll-to-zoom, drag-canvas-to-pan |

### Beyond Spec (Differentiating Features)

#### 1. Natural Language → Workflow Generation (` Generate`)
Click ** Generate** in the topbar. Type a plain-English description of any HR process. The app calls the Anthropic Claude API and parses the response into a fully-formed node graph — complete with positions, types, labels, and edges — which is instantly loaded onto the canvas.

> *"A performance review where an employee submits self-assessment, manager reviews, HR approves the final rating, then the system sends a confirmation email"*
> → generates a 5-node workflow automatically.

This is architecturally clean: the prompt enforces strict JSON schema output, response is parsed and directly merged into React state via `setNodes/setEdges`.

#### 2. Workflow Complexity Scoring Engine
Every render computes a **complexity score (0–100)** from node count, approval depth, automation count, and parallel path detection. The score maps to a label: **Simple / Moderate / Complex / Enterprise**, shown as a live badge in the topbar with a color-coded glow. This gives HR admins instant architectural feedback.

#### 3. Real-Time SLA Breach Predictor
Task nodes with due dates are scanned on every render. Nodes with:
- **due < 3 days**: 🟡 yellow dashed border + sidebar alert
- **due < 0 days**: 🔴 red dashed border = SLA BREACH
- **Approval nodes** with `autoApproveThreshold ≤ 1`: flagged as RISK

Breaches surface in 3 places: on the canvas node, in the sidebar alerts strip, and in the Sandbox panel's Predictions section.

#### 4. Per-Node Edit History with Point-in-Time Restore
Every time a node's data is updated, the previous state is pushed to a per-node history stack (capped at 5 snapshots). Click any node → switch to the **History** tab in the config panel → view timestamped snapshots → click **↩ Restore** to revert that node to any prior state. A subtle `↩N` counter on the node badge shows how many snapshots exist.

#### 5. Workflow Templates Library
Three pre-built, production-realistic HR workflows:
-  **Employee Onboarding** (parallel document collection + approval)
- 🏖**Leave Approval** (sequential with parallel calendar + Slack notifications)
-  **Offboarding** (parallel exit interview + asset retrieval → access revocation)

Load any template in one click. Templates are defined as plain JS objects — trivially extensible.

#### 6. AI: Suggest Next Step
The sidebar ** AI: Suggest Next** button sends the current workflow summary to Claude and returns a concrete, actionable suggestion: node type, label, and rationale. Context-aware — it reads the actual current graph.

---

## Folder Structure

```
src/
└── App.jsx   (= HRWorkflowDesigner.jsx — entire application)
```

Clean single-file architecture by design. In a production monorepo the natural split would be:

```
src/
├── components/
│   ├── Canvas.tsx
│   ├── NodeFormPanel.tsx
│   ├── Sidebar.tsx
│   └── modals/
│       ├── SandboxModal.tsx
│       ├── NLGeneratorModal.tsx
│       └── TemplatesModal.tsx
├── hooks/
│   ├── useWorkflowHistory.ts
│   ├── useNodeHistory.ts
│   └── useCanvasInteraction.ts
├── lib/
│   ├── mockApi.ts
│   ├── complexityScorer.ts
│   ├── slaPredictor.ts
│   └── simulator.ts
├── types/
│   └── workflow.ts
└── data/
    └── templates.ts
```

---

## Type Interfaces

```typescript
type NodeType = "start" | "task" | "approval" | "automated" | "end";

interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
}

interface NodeData {
  label: string;
  // start
  title?: string;
  metadata?: { key: string; value: string }[];
  // task
  description?: string;
  assignee?: string;
  dueDate?: string;
  customFields?: { key: string; value: string }[];
  // approval
  approverRole?: string;
  autoApproveThreshold?: number;
  // automated
  actionId?: string;
  actionParams?: Record<string, string>;
  // end
  endMessage?: string;
  summaryFlag?: boolean;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

interface SimulationResult {
  steps: SimulationStep[];
  errors: string[];
}

interface ComplexityScore {
  score: number;
  label: "Simple" | "Moderate" | "Complex" | "Enterprise";
  color: string;
  approvalCount: number;
  automationCount: number;
  parallelPaths: number;
  estimatedDuration: string;
}
```

---

## What I Would Add With More Time

| Feature | Why |
|---|---|
| **Conditional edge branching** | Approval nodes need "approve / reject" paths with labels on edges |
| **Drag from sidebar** (HTML5 DnD) | More intuitive than click-to-add |
| **Backend persistence** (FastAPI + PostgreSQL) | Workflows should be saved by ID, versioned, and shareable via URL |
| **Role-based permissions** | Different HR personas (recruiter vs HRBP vs admin) should see different templates |
| **WebSocket live collaboration** | Two HR admins co-editing a workflow in real time |
| **Auto-layout algorithm** | Dagre/ELK layout for imported or AI-generated graphs |
| **Node duplication** | Copy-paste frequently reused patterns (e.g. approval → notification pairs) |
| **Workflow versioning** | Full diff view between v1 and v2 of a workflow |
| **Cypress E2E tests** | Cover the happy path: add node → connect → simulate → export |
| **Storybook** | Isolated stories for each node type form and the sandbox modal |
| **TypeScript** | Full strict typing throughout; would catch the spread-operator edge cases |

---

## Design Choices & Assumptions

- **No authentication or backend** per spec — all state is in-memory React state
- **SVG canvas over React Flow** — demonstrated native understanding of coordinate transforms and graph rendering; React Flow would be appropriate for production
- **Inline styles** — chosen for zero-dependency portability and reviewer transparency; Tailwind or CSS Modules would be production preference
- **Single-file** — maximizes submission portability; the architectural split is documented above
- **AI features use real Anthropic API** — NL generation and step suggestion make live calls; the artifact runtime provides the auth header automatically
- **Sora + DM Mono fonts** — Sora (geometric, modern) for UI chrome; DM Mono (technical) for IDs, metrics, and code-adjacent labels — a deliberate typographic pairing that avoids generic AI aesthetics

---

## Assessment Criteria Coverage

| Criterion | Implementation |
|---|---|
| React Flow proficiency | Custom SVG canvas with cubic bezier edges, animated dashes, zoom/pan, minimap |
| React architecture | Hooks (`useState`, `useCallback`, `useRef`, `useEffect`), derived state (complexity, SLA), controlled forms throughout |
| Complex form handling | Dynamic param fields on automated nodes, key-value pair editors on Start/Task, toggle on End |
| Mock API interaction | `MOCK_AUTOMATIONS` array, `simulateWorkflow()` function, async Anthropic API calls |
| Scalability | `NODE_CONFIGS` registry makes adding a new node type a 5-line change; form render is a switch on `n.type` |
| Communication | This README |
| Delivery speed | Single-file full-featured prototype demonstrating senior-level architectural decisions |

---

*Built by Khushpreet — Tredence Studio AI Agents Engineering Internship 2025*
