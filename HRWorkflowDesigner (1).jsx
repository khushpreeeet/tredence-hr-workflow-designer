
import { useState, useCallback, useRef, useEffect } from "react";

// ─── MOCK API LAYER ────────────────────────────────────────────────────────────
const MOCK_AUTOMATIONS = [
  { id: "send_email",       label: "Send Email",            params: ["to", "subject", "body"] },
  { id: "generate_doc",     label: "Generate Document",     params: ["template", "recipient"] },
  { id: "slack_notify",     label: "Slack Notification",    params: ["channel", "message"] },
  { id: "update_hris",      label: "Update HRIS Record",    params: ["employee_id", "field", "value"] },
  { id: "schedule_meet",    label: "Schedule Meeting",      params: ["attendees", "duration", "title"] },
  { id: "provision_access", label: "Provision System Access", params: ["system", "role", "employee_id"] },
  { id: "run_bg_check",     label: "Background Check",      params: ["provider", "employee_id"] },
];

// POST /simulate — topological BFS execution
function simulateWorkflow(nodes, edges) {
  const errors = [];
  const startNodes = nodes.filter(n => n.type === "start");
  const endNodes   = nodes.filter(n => n.type === "end");

  if (startNodes.length === 0) errors.push("Missing Start Node");
  if (startNodes.length > 1)  errors.push("Multiple Start Nodes detected");
  if (endNodes.length   === 0) errors.push("Missing End Node");

  nodes.forEach(node => {
    if (node.type === "start") return;
    const hasIncoming = edges.some(e => e.target === node.id);
    if (!hasIncoming) errors.push(`Node "${node.data.label}" has no incoming connection`);
  });

  const adj = {};
  nodes.forEach(n => (adj[n.id] = []));
  edges.forEach(e => adj[e.source]?.push(e.target));

  const visited = new Set();
  const steps = [];
  const queue = startNodes.map(n => n.id);

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) { errors.push("Cycle detected in workflow"); break; }
    visited.add(current);
    const node = nodes.find(n => n.id === current);
    if (node) {
      steps.push({
        id: node.id, type: node.type, label: node.data.label,
        status: errors.length === 0 ? "success" : "warning",
        message: getStepMessage(node),
      });
      (adj[current] || []).forEach(nxt => { if (!visited.has(nxt)) queue.push(nxt); });
    }
  }
  return { steps, errors };
}

function getStepMessage(node) {
  switch (node.type) {
    case "start":     return `Workflow initiated: "${node.data.title || node.data.label}"`;
    case "task":      return `Task assigned to ${node.data.assignee || "unassigned"}: ${node.data.description || "No description"}`;
    case "approval":  return `Awaiting approval from ${node.data.approverRole || "Manager"} (auto-approve: ${node.data.autoApproveThreshold}d)`;
    case "automated": return `Executing: ${MOCK_AUTOMATIONS.find(a => a.id === node.data.actionId)?.label || node.data.actionId}`;
    case "end":       return node.data.endMessage || "Workflow completed successfully";
    default:          return "Processing...";
  }
}

// ─── COMPLEXITY SCORING ENGINE ────────────────────────────────────────────────
function scoreWorkflowComplexity(nodes, edges) {
  const approvalCount   = nodes.filter(n => n.type === "approval").length;
  const automationCount = nodes.filter(n => n.type === "automated").length;
  const outDegree = {};
  nodes.forEach(n => (outDegree[n.id] = 0));
  edges.forEach(e => { if (outDegree[e.source] !== undefined) outDegree[e.source]++; });
  const parallelPaths = Object.values(outDegree).filter(d => d > 1).length;
  const score = Math.min(100, nodes.length * 8 + approvalCount * 12 + automationCount * 6 + parallelPaths * 15);
  return {
    score,
    label: score < 30 ? "Simple" : score < 60 ? "Moderate" : score < 80 ? "Complex" : "Enterprise",
    color: score < 30 ? "#34d399" : score < 60 ? "#fbbf24" : score < 80 ? "#fb923c" : "#f87171",
    approvalCount, automationCount, parallelPaths,
    estimatedDuration: `${Math.max(1, nodes.length - 2)}–${Math.max(2, nodes.length)} days`,
  };
}

// ─── SLA BREACH PREDICTOR ─────────────────────────────────────────────────────
function predictSLABreaches(nodes) {
  const breaches = [];
  nodes.forEach(n => {
    if (n.type === "task" && n.data.dueDate) {
      const daysLeft = Math.floor((new Date(n.data.dueDate) - new Date()) / 86400000);
      if (daysLeft < 0)  breaches.push({ nodeId: n.id, label: n.data.label, daysLeft, severity: "BREACH" });
      else if (daysLeft < 3) breaches.push({ nodeId: n.id, label: n.data.label, daysLeft, severity: "WARNING" });
    }
    if (n.type === "approval" && n.data.autoApproveThreshold <= 1)
      breaches.push({ nodeId: n.id, label: n.data.label, severity: "RISK" });
  });
  return breaches;
}

// ─── NODE VISUAL CONFIG ────────────────────────────────────────────────────────
const NODE_CONFIGS = {
  start:     { label: "Start",     color: "#22d3ee", icon: "▶", bg: "rgba(34,211,238,0.09)",   border: "#22d3ee" },
  task:      { label: "Task",      color: "#a78bfa", icon: "📋", bg: "rgba(167,139,250,0.09)",  border: "#a78bfa" },
  approval:  { label: "Approval",  color: "#fb923c", icon: "✅", bg: "rgba(251,146,60,0.09)",   border: "#fb923c" },
  automated: { label: "Auto Step", color: "#34d399", icon: "⚡", bg: "rgba(52,211,153,0.09)",   border: "#34d399" },
  end:       { label: "End",       color: "#f87171", icon: "⏹",  bg: "rgba(248,113,113,0.09)", border: "#f87171" },
};

// ─── INITIAL WORKFLOW ─────────────────────────────────────────────────────────
const INITIAL_NODES = [
  { id: "1", type: "start",     position: { x: 340, y: 60  }, data: { label: "Start",             title: "Onboarding Begins",              metadata: [] } },
  { id: "2", type: "task",      position: { x: 180, y: 200 }, data: { label: "Collect Documents",  description: "Gather ID & offer letter", assignee: "HR Admin", dueDate: "2025-07-01", customFields: [] } },
  { id: "3", type: "approval",  position: { x: 500, y: 200 }, data: { label: "Manager Approval",   approverRole: "Manager", autoApproveThreshold: 3 } },
  { id: "4", type: "automated", position: { x: 340, y: 360 }, data: { label: "Send Welcome Email", actionId: "send_email", actionParams: { to: "new.hire@company.com", subject: "Welcome aboard!", body: "" } } },
  { id: "5", type: "end",       position: { x: 340, y: 500 }, data: { label: "End",                endMessage: "Onboarding complete!",      summaryFlag: true } },
];
const INITIAL_EDGES = [
  { id: "e1-2", source: "1", target: "2" },
  { id: "e1-3", source: "1", target: "3" },
  { id: "e2-4", source: "2", target: "4" },
  { id: "e3-4", source: "3", target: "4" },
  { id: "e4-5", source: "4", target: "5" },
];

// ─── WORKFLOW TEMPLATES ───────────────────────────────────────────────────────
const WORKFLOW_TEMPLATES = {
  onboarding: {
    name: "🚀 Employee Onboarding", nodes: INITIAL_NODES, edges: INITIAL_EDGES,
  },
  leave: {
    name: "🏖 Leave Approval",
    nodes: [
      { id: "t1", type: "start",     position: { x: 340, y: 60  }, data: { label: "Leave Request",  title: "Leave Approval Flow", metadata: [] } },
      { id: "t2", type: "task",      position: { x: 340, y: 200 }, data: { label: "Fill Leave Form", description: "Employee fills request form", assignee: "Employee", dueDate: "", customFields: [] } },
      { id: "t3", type: "approval",  position: { x: 340, y: 340 }, data: { label: "Manager Review",  approverRole: "Manager", autoApproveThreshold: 2 } },
      { id: "t4", type: "automated", position: { x: 180, y: 480 }, data: { label: "Update Calendar", actionId: "schedule_meet", actionParams: { attendees: "", duration: "OOO", title: "Leave Block" } } },
      { id: "t5", type: "automated", position: { x: 500, y: 480 }, data: { label: "Notify HR",       actionId: "slack_notify",   actionParams: { channel: "#hr-ops", message: "Leave approved" } } },
      { id: "t6", type: "end",       position: { x: 340, y: 620 }, data: { label: "End",             endMessage: "Leave approved and recorded.", summaryFlag: false } },
    ],
    edges: [
      { id: "et1-2", source: "t1", target: "t2" }, { id: "et2-3", source: "t2", target: "t3" },
      { id: "et3-4", source: "t3", target: "t4" }, { id: "et3-5", source: "t3", target: "t5" },
      { id: "et4-6", source: "t4", target: "t6" }, { id: "et5-6", source: "t5", target: "t6" },
    ],
  },
  offboarding: {
    name: "👋 Offboarding",
    nodes: [
      { id: "o1", type: "start",     position: { x: 340, y: 60  }, data: { label: "Offboarding Start", title: "Employee Exit Flow", metadata: [] } },
      { id: "o2", type: "task",      position: { x: 180, y: 200 }, data: { label: "Exit Interview",    description: "Schedule and conduct exit interview", assignee: "HRBP", dueDate: "", customFields: [] } },
      { id: "o3", type: "task",      position: { x: 500, y: 200 }, data: { label: "Asset Retrieval",   description: "Collect laptop, badge, keys", assignee: "IT Admin", dueDate: "", customFields: [] } },
      { id: "o4", type: "automated", position: { x: 180, y: 360 }, data: { label: "Revoke Access",     actionId: "provision_access", actionParams: { system: "ALL", role: "REVOKE", employee_id: "" } } },
      { id: "o5", type: "automated", position: { x: 500, y: 360 }, data: { label: "Final Payroll",     actionId: "update_hris",      actionParams: { employee_id: "", field: "status", value: "terminated" } } },
      { id: "o6", type: "end",       position: { x: 340, y: 500 }, data: { label: "End",               endMessage: "Offboarding complete.", summaryFlag: true } },
    ],
    edges: [
      { id: "eo1-2", source: "o1", target: "o2" }, { id: "eo1-3", source: "o1", target: "o3" },
      { id: "eo2-4", source: "o2", target: "o4" }, { id: "eo3-5", source: "o3", target: "o5" },
      { id: "eo4-6", source: "o4", target: "o6" }, { id: "eo5-6", source: "o5", target: "o6" },
    ],
  },
};

let nodeIdCounter = 10;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [edges, setEdges] = useState(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [draggingNode, setDraggingNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showSandbox, setShowSandbox] = useState(false);
  const [simResult, setSimResult] = useState(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simStep, setSimStep] = useState(-1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [validationErrors, setValidationErrors] = useState({});
  const [showExport, setShowExport] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  // ── novel additions
  const [showNLPanel, setShowNLPanel] = useState(false);
  const [nlPrompt, setNlPrompt] = useState("");
  const [nlLoading, setNlLoading] = useState(false);
  const [nlError, setNlError] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [nodeHistory, setNodeHistory] = useState({});   // per-node edit history
  const [activeTab, setActiveTab] = useState("form");   // "form" | "history"
  const canvasRef = useRef(null);

  // derived
  const complexity  = scoreWorkflowComplexity(nodes, edges);
  const slaBreaches = predictSLABreaches(nodes);

  // ── UNDO / REDO ──────────────────────────────────────────────────────────────
  const saveHistory = useCallback((n, e) => {
    const snap = history.slice(0, historyIndex + 1);
    snap.push({ nodes: n, edges: e });
    setHistory(snap);
    setHistoryIndex(snap.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const p = history[historyIndex - 1];
      setNodes(p.nodes); setEdges(p.edges); setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const n = history[historyIndex + 1];
      setNodes(n.nodes); setEdges(n.edges); setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  useEffect(() => {
    setHistory([{ nodes: INITIAL_NODES, edges: INITIAL_EDGES }]);
    setHistoryIndex(0);
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "y") { e.preventDefault(); redo(); }
      if ((e.key === "Delete" || e.key === "Backspace") &&
          document.activeElement.tagName !== "INPUT" &&
          document.activeElement.tagName !== "TEXTAREA") {
        deleteSelected();
      }
      if (e.key === "Escape") { setConnectingFrom(null); setSelectedNode(null); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo, selectedNode]);

  // ── NODE OPERATIONS ──────────────────────────────────────────────────────────
  const addNode = useCallback((type) => {
    const id = String(++nodeIdCounter);
    const cfg = NODE_CONFIGS[type];
    const newNode = {
      id, type,
      position: { x: 220 + Math.random() * 180, y: 120 + Math.random() * 280 },
      data: {
        label: cfg.label,
        ...(type === "start"     ? { title: "New Start",  metadata: [] }                         : {}),
        ...(type === "task"      ? { description: "", assignee: "", dueDate: "", customFields: [] } : {}),
        ...(type === "approval"  ? { approverRole: "Manager", autoApproveThreshold: 2 }           : {}),
        ...(type === "automated" ? { actionId: "send_email", actionParams: {} }                   : {}),
        ...(type === "end"       ? { endMessage: "Done", summaryFlag: false }                     : {}),
      },
    };
    const nn = [...nodes, newNode];
    setNodes(nn); saveHistory(nn, edges); setSelectedNode(newNode);
  }, [nodes, edges, saveHistory]);

  const deleteSelected = useCallback(() => {
    if (!selectedNode) return;
    const nn = nodes.filter(n => n.id !== selectedNode.id);
    const ne = edges.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id);
    setNodes(nn); setEdges(ne); setSelectedNode(null); saveHistory(nn, ne);
  }, [selectedNode, nodes, edges, saveHistory]);

  const updateNode = useCallback((id, newData) => {
    const prev = nodes.find(n => n.id === id);
    if (prev) {
      setNodeHistory(h => ({
        ...h,
        [id]: [...(h[id] || []).slice(-4), { data: { ...prev.data }, ts: new Date().toLocaleTimeString() }]
      }));
    }
    setNodes(p => p.map(n => n.id === id ? { ...n, data: { ...n.data, ...newData } } : n));
  }, [nodes]);

  const saveNodeEdit = useCallback(() => saveHistory(nodes, edges), [nodes, edges, saveHistory]);

  // ── NATURAL LANGUAGE → WORKFLOW ──────────────────────────────────────────────
  const generateFromNL = async () => {
    if (!nlPrompt.trim()) return;
    setNlLoading(true); setNlError("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are an HR workflow generator. Given: "${nlPrompt}"
Generate a workflow JSON (respond ONLY with valid JSON, no markdown fences):
{
  "nodes": [
    {"id":"g1","type":"start","position":{"x":340,"y":60},"data":{"label":"...","title":"...","metadata":[]}},
    {"id":"g2","type":"task","position":{"x":340,"y":200},"data":{"label":"...","description":"...","assignee":"...","dueDate":"","customFields":[]}},
    {"id":"g3","type":"approval","position":{"x":340,"y":340},"data":{"label":"...","approverRole":"Manager","autoApproveThreshold":3}},
    {"id":"g4","type":"end","position":{"x":340,"y":480},"data":{"label":"End","endMessage":"...","summaryFlag":true}}
  ],
  "edges":[{"id":"eg1-2","source":"g1","target":"g2"},{"id":"eg2-3","source":"g2","target":"g3"},{"id":"eg3-4","source":"g3","target":"g4"}]
}
Rules: types are start/task/approval/automated/end; 3-7 nodes; always start→end; y increases ~140/step; parallel = different x (200 and 500). Be specific to the HR use case. Return ONLY JSON.`
          }]
        })
      });
      const data = await res.json();
      const raw = data.content?.map(c => c.text || "").join("") || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (parsed.nodes && parsed.edges) {
        setNodes(parsed.nodes); setEdges(parsed.edges); saveHistory(parsed.nodes, parsed.edges);
        setShowNLPanel(false); setNlPrompt("");
      } else throw new Error("bad structure");
    } catch { setNlError("Generation failed — try rephrasing your description."); }
    setNlLoading(false);
  };

  // ── AI SUGGEST NEXT STEP ──────────────────────────────────────────────────────
  const getAiSuggestion = async () => {
    setAiLoading(true); setAiSuggestion(null);
    try {
      const summary = nodes.map(n => `${n.type}:${n.data.label}`).join(", ");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          messages: [{ role: "user", content: `HR workflow: ${summary}. Suggest ONE next node. Format: [TYPE] "Label" — 1-sentence reason. Concise.` }]
        })
      });
      const data = await res.json();
      setAiSuggestion(data.content?.map(c => c.text || "").join("") || "No suggestion.");
    } catch { setAiSuggestion("Could not fetch suggestion."); }
    setAiLoading(false);
  };

  // ── EXPORT / IMPORT ───────────────────────────────────────────────────────────
  const exportWorkflow = () => {
    const payload = { nodes, edges, metadata: { exportedAt: new Date().toISOString(), complexity: complexity.label } };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "workflow.json"; a.click();
  };
  const importWorkflow = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed.nodes && parsed.edges) { setNodes(parsed.nodes); setEdges(parsed.edges); saveHistory(parsed.nodes, parsed.edges); }
      } catch { alert("Invalid JSON file"); }
    };
    reader.readAsText(file);
  };
  const loadTemplate = (key) => {
    const t = WORKFLOW_TEMPLATES[key];
    setNodes(t.nodes); setEdges(t.edges); saveHistory(t.nodes, t.edges);
    setShowTemplates(false); setSelectedNode(null);
  };

  // ── CANVAS EVENTS ─────────────────────────────────────────────────────────────
  const getCanvasPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom };
  };

  const onNodeMouseDown = (e, node) => {
    e.stopPropagation();
    if (connectingFrom) {
      if (connectingFrom !== node.id && !edges.find(ed => ed.source === connectingFrom && ed.target === node.id)) {
        const ne = [...edges, { id: `e${connectingFrom}-${node.id}`, source: connectingFrom, target: node.id }];
        setEdges(ne); saveHistory(nodes, ne);
      }
      setConnectingFrom(null); return;
    }
    setSelectedNode(node);
    const pos = getCanvasPos(e);
    setDraggingNode(node.id);
    setDragOffset({ x: pos.x - node.position.x, y: pos.y - node.position.y });
  };

  const onCanvasMouseMove = (e) => {
    if (draggingNode) {
      const pos = getCanvasPos(e);
      setNodes(prev => prev.map(n => n.id === draggingNode
        ? { ...n, position: { x: pos.x - dragOffset.x, y: pos.y - dragOffset.y } }
        : n));
    } else if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const onCanvasMouseUp = () => {
    if (draggingNode) { saveHistory(nodes, edges); setDraggingNode(null); }
    setIsPanning(false);
  };

  const onCanvasMouseDown = (e) => {
    if (e.target === canvasRef.current || e.target.tagName === "svg" || e.target.tagName === "rect") {
      setSelectedNode(null); setConnectingFrom(null); setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const onWheel = (e) => {
    e.preventDefault();
    setZoom(z => Math.min(Math.max(z * (e.deltaY > 0 ? 0.9 : 1.1), 0.3), 2));
  };

  // ── SIMULATION ────────────────────────────────────────────────────────────────
  const runSimulation = async () => {
    setSimRunning(true); setSimStep(-1);
    const result = simulateWorkflow(nodes, edges);
    const errMap = {};
    nodes.forEach(n => {
      if (n.type !== "start" && !edges.some(e => e.target === n.id))
        errMap[n.id] = ["No incoming connection"];
    });
    setValidationErrors(errMap); setSimResult(result);
    for (let i = 0; i < result.steps.length; i++) {
      await new Promise(r => setTimeout(r, 700)); setSimStep(i);
    }
    setSimRunning(false);
  };

  // ── RENDER EDGE ───────────────────────────────────────────────────────────────
  const renderEdge = (edge) => {
    const src = nodes.find(n => n.id === edge.source);
    const tgt = nodes.find(n => n.id === edge.target);
    if (!src || !tgt) return null;
    const x1 = src.position.x + 102, y1 = src.position.y + 38;
    const x2 = tgt.position.x + 102, y2 = tgt.position.y + 38;
    const d  = `M ${x1} ${y1} C ${x1} ${(y1+y2)/2}, ${x2} ${(y1+y2)/2}, ${x2} ${y2}`;
    const mx = (x1+x2)/2, my = (y1+y2)/2;
    return (
      <g key={edge.id}>
        <path d={d} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="2.5" />
        <path d={d} fill="none" stroke="url(#edgeGrad)" strokeWidth="2"
          strokeDasharray="6 3" style={{ animation: "dashMove 1.5s linear infinite" }} />
        <circle cx={mx} cy={my} r="7" fill="#0a1628" stroke="rgba(148,163,184,0.35)" strokeWidth="1.5" />
        <text x={mx} y={my+4} textAnchor="middle" fontSize="8" fill="rgba(148,163,184,0.7)"
          style={{ cursor: "pointer", userSelect: "none" }}
          onClick={() => { const ne = edges.filter(e=>e.id!==edge.id); setEdges(ne); saveHistory(nodes,ne); }}>✕</text>
      </g>
    );
  };

  // ── RENDER NODE ───────────────────────────────────────────────────────────────
  const renderNode = (node) => {
    const cfg = NODE_CONFIGS[node.type] || NODE_CONFIGS.task;
    const isSelected    = selectedNode?.id === node.id;
    const isConnecting  = connectingFrom === node.id;
    const hasError      = validationErrors[node.id];
    const isHighlighted = simResult && simStep >= 0 &&
      simResult.steps.slice(0, simStep+1).some(s => s.id === node.id);
    const slaBreach     = slaBreaches.find(b => b.nodeId === node.id);

    return (
      <g key={node.id} transform={`translate(${node.position.x},${node.position.y})`}
        style={{ cursor: draggingNode===node.id ? "grabbing" : "grab" }}
        onMouseDown={e => onNodeMouseDown(e, node)}>

        {(isSelected || isHighlighted) && (
          <rect x="-5" y="-5" width="215" height="87" rx="15"
            fill="none" stroke={isHighlighted ? "#22d3ee" : cfg.color} strokeWidth="2" opacity="0.55"
            style={{ filter: `drop-shadow(0 0 10px ${cfg.color}88)` }} />
        )}
        {hasError && !isSelected && (
          <rect x="-3" y="-3" width="211" height="83" rx="13" fill="none"
            stroke="#f87171" strokeWidth="2" strokeDasharray="4 3" opacity="0.75" />
        )}
        {slaBreach && !hasError && (
          <rect x="-3" y="-3" width="211" height="83" rx="13" fill="none"
            stroke={slaBreach.severity==="BREACH"?"#f87171":"#fbbf24"} strokeWidth="1.5" strokeDasharray="6 2" opacity="0.65" />
        )}

        <rect x="0" y="0" width="205" height="78" rx="13"
          fill={cfg.bg} stroke={isSelected ? cfg.color : "rgba(148,163,184,0.16)"}
          strokeWidth={isSelected ? 2 : 1} />
        <rect x="0" y="0" width="4" height="78" rx="2" fill={cfg.color} />

        <text x="20" y="44" fontSize="18" style={{ userSelect: "none" }}>{cfg.icon}</text>
        <text x="50" y="28" fontSize="9" fontWeight="700" fill={cfg.color}
          fontFamily="'DM Mono', monospace" letterSpacing="1.5" style={{ userSelect: "none" }}>
          {cfg.label.toUpperCase()}
        </text>
        <text x="50" y="49" fontSize="13" fontWeight="600" fill="rgba(226,232,240,0.9)"
          fontFamily="'Sora', sans-serif" style={{ userSelect: "none" }}>
          {(node.data.label || node.data.title || "Untitled").slice(0, 20)}
        </text>
        {node.data.assignee && (
          <text x="50" y="66" fontSize="10" fill="rgba(148,163,184,0.5)"
            fontFamily="'DM Mono', monospace" style={{ userSelect: "none" }}>
            👤 {node.data.assignee.slice(0, 16)}
          </text>
        )}
        {slaBreach && (
          <text x="196" y="18" textAnchor="end" fontSize="12" style={{ userSelect: "none" }}>
            {slaBreach.severity==="BREACH"?"🔴":"🟡"}
          </text>
        )}
        {(nodeHistory[node.id]?.length > 0) && (
          <text x="181" y="70" fontSize="9" fill="rgba(148,163,184,0.3)"
            fontFamily="'DM Mono', monospace" style={{ userSelect: "none" }}>
            ↩{nodeHistory[node.id].length}
          </text>
        )}

        {/* connection handle */}
        <circle cx="195" cy="39" r="8" fill={isConnecting ? cfg.color : "rgba(10,22,40,0.95)"}
          stroke={cfg.color} strokeWidth="2" style={{ cursor: "crosshair" }}
          onClick={e => { e.stopPropagation(); setConnectingFrom(connectingFrom===node.id ? null : node.id); }} />
        <text x="195" y="43" textAnchor="middle" fontSize="10"
          fill={isConnecting ? "#000" : cfg.color}
          style={{ userSelect: "none", pointerEvents: "none" }}>→</text>

        {isHighlighted && (
          <circle cx="16" cy="8" r="5" fill="#22d3ee"
            style={{ animation: "pulse 1s infinite" }} />
        )}
      </g>
    );
  };

  // ── NODE FORM PANEL ───────────────────────────────────────────────────────────
  const renderNodeForm = () => {
    if (!selectedNode) return null;
    const n = nodes.find(x => x.id === selectedNode.id);
    if (!n) return null;
    const cfg = NODE_CONFIGS[n.type];
    const up = (d) => updateNode(n.id, d);
    const nh = nodeHistory[n.id] || [];

    const Field = ({ label, children }) => (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(148,163,184,0.5)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 5 }}>{label}</div>
        {children}
      </div>
    );
    const inputStyle = { width: "100%", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(148,163,184,0.16)", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.2s" };
    const Input = ({ value, onChange, placeholder, type="text" }) => (
      <input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={inputStyle}
        onFocus={e=>e.target.style.borderColor=cfg.color+"88"}
        onBlur={e=>e.target.style.borderColor="rgba(148,163,184,0.16)"} />
    );
    const Select = ({ value, onChange, options }) => (
      <select value={value||""} onChange={e=>onChange(e.target.value)} style={inputStyle}>
        {options.map(o => <option key={o.id||o} value={o.id||o}>{o.label||o}</option>)}
      </select>
    );

    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{cfg.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: cfg.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2 }}>{cfg.label}</div>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,0.4)", fontFamily: "'DM Mono', monospace" }}>id:{n.id}</div>
          </div>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 16, background: "rgba(15,23,42,0.6)", borderRadius: 8, padding: 3 }}>
          {["form","history"].map(tab => (
            <button key={tab} onClick={()=>setActiveTab(tab)}
              style={{ flex:1, background: activeTab===tab ? cfg.bg : "none", border: activeTab===tab ? `1px solid ${cfg.color}44` : "1px solid transparent", borderRadius: 6, color: activeTab===tab ? cfg.color : "rgba(148,163,184,0.35)", cursor: "pointer", padding: "5px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>
              {tab==="history" ? `History (${nh.length})` : "Config"}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
          {activeTab==="form" ? (
            <>
              {validationErrors[n.id] && (
                <div style={{ background:"rgba(248,113,113,0.07)", border:"1px solid rgba(248,113,113,0.22)", borderRadius:8, padding:"8px 12px", marginBottom:14 }}>
                  {validationErrors[n.id].map((e,i)=><div key={i} style={{fontSize:11,color:"#f87171"}}>⚠ {e}</div>)}
                </div>
              )}
              {(() => {
                const b = slaBreaches.find(b=>b.nodeId===n.id);
                if (!b) return null;
                return (
                  <div style={{ background: b.severity==="BREACH"?"rgba(248,113,113,0.07)":"rgba(251,191,36,0.07)", border:`1px solid ${b.severity==="BREACH"?"rgba(248,113,113,0.25)":"rgba(251,191,36,0.25)"}`, borderRadius:8, padding:"8px 12px", marginBottom:14 }}>
                    <div style={{fontSize:11, color: b.severity==="BREACH"?"#f87171":"#fbbf24"}}>
                      {b.severity==="BREACH" ? `🔴 SLA Breached (${Math.abs(b.daysLeft)}d overdue)` : b.severity==="RISK" ? "🟡 Auto-approve threshold risk" : `🟡 Due in ${b.daysLeft}d`}
                    </div>
                  </div>
                );
              })()}

              <Field label="Display Label">
                <Input value={n.data.label} onChange={v=>up({label:v})} placeholder="Node label" />
              </Field>

              {n.type==="start" && <>
                <Field label="Workflow Title">
                  <Input value={n.data.title} onChange={v=>up({title:v})} placeholder="e.g. Employee Onboarding" />
                </Field>
                <Field label="Metadata (key:value)">
                  {(n.data.metadata||[]).map((m,i)=>(
                    <div key={i} style={{display:"flex",gap:6,marginBottom:6}}>
                      <input value={m.key} onChange={e=>{const md=[...n.data.metadata];md[i]={...md[i],key:e.target.value};up({metadata:md});}}
                        placeholder="key" style={{flex:1,...inputStyle,padding:"6px 8px",fontSize:11}} />
                      <input value={m.value} onChange={e=>{const md=[...n.data.metadata];md[i]={...md[i],value:e.target.value};up({metadata:md});}}
                        placeholder="value" style={{flex:1,...inputStyle,padding:"6px 8px",fontSize:11}} />
                      <button onClick={()=>up({metadata:n.data.metadata.filter((_,j)=>j!==i)})}
                        style={{background:"rgba(248,113,113,0.12)",border:"none",borderRadius:6,color:"#f87171",cursor:"pointer",padding:"0 8px"}}>✕</button>
                    </div>
                  ))}
                  <button onClick={()=>up({metadata:[...(n.data.metadata||[]),{key:"",value:""}]})}
                    style={{background:"rgba(34,211,238,0.07)",border:"1px solid rgba(34,211,238,0.22)",borderRadius:6,color:"#22d3ee",cursor:"pointer",padding:"6px 12px",fontSize:11,width:"100%"}}>+ Add Pair</button>
                </Field>
              </>}

              {n.type==="task" && <>
                <Field label="Description">
                  <Input value={n.data.description} onChange={v=>up({description:v})} placeholder="What needs to be done?" />
                </Field>
                <Field label="Assignee">
                  <Input value={n.data.assignee} onChange={v=>up({assignee:v})} placeholder="e.g. HR Admin" />
                </Field>
                <Field label="Due Date">
                  <Input value={n.data.dueDate} onChange={v=>up({dueDate:v})} type="date" />
                </Field>
                <Field label="Custom Fields">
                  {(n.data.customFields||[]).map((cf,i)=>(
                    <div key={i} style={{display:"flex",gap:6,marginBottom:6}}>
                      <input value={cf.key} onChange={e=>{const arr=[...n.data.customFields];arr[i]={...arr[i],key:e.target.value};up({customFields:arr});}}
                        placeholder="key" style={{flex:1,...inputStyle,padding:"6px 8px",fontSize:11}} />
                      <input value={cf.value} onChange={e=>{const arr=[...n.data.customFields];arr[i]={...arr[i],value:e.target.value};up({customFields:arr});}}
                        placeholder="value" style={{flex:1,...inputStyle,padding:"6px 8px",fontSize:11}} />
                      <button onClick={()=>up({customFields:n.data.customFields.filter((_,j)=>j!==i)})}
                        style={{background:"rgba(248,113,113,0.12)",border:"none",borderRadius:6,color:"#f87171",cursor:"pointer",padding:"0 8px"}}>✕</button>
                    </div>
                  ))}
                  <button onClick={()=>up({customFields:[...(n.data.customFields||[]),{key:"",value:""}]})}
                    style={{background:"rgba(167,139,250,0.07)",border:"1px solid rgba(167,139,250,0.22)",borderRadius:6,color:"#a78bfa",cursor:"pointer",padding:"6px 12px",fontSize:11,width:"100%"}}>+ Add Field</button>
                </Field>
              </>}

              {n.type==="approval" && <>
                <Field label="Approver Role">
                  <Select value={n.data.approverRole} onChange={v=>up({approverRole:v})} options={["Manager","HRBP","Director","VP","C-Suite"]} />
                </Field>
                <Field label="Auto-approve After (days)">
                  <Input value={n.data.autoApproveThreshold} onChange={v=>up({autoApproveThreshold:Number(v)})} type="number" placeholder="e.g. 3" />
                </Field>
              </>}

              {n.type==="automated" && <>
                <Field label="Action">
                  <Select value={n.data.actionId} onChange={v=>{
                    const action=MOCK_AUTOMATIONS.find(a=>a.id===v);
                    const np={}; (action?.params||[]).forEach(p=>np[p]="");
                    up({actionId:v,actionParams:np});
                  }} options={MOCK_AUTOMATIONS} />
                </Field>
                {MOCK_AUTOMATIONS.find(a=>a.id===n.data.actionId)?.params.map(param=>(
                  <Field key={param} label={param.replace(/_/g," ")}>
                    <Input value={(n.data.actionParams||{})[param]} onChange={v=>up({actionParams:{...n.data.actionParams,[param]:v}})} placeholder={param} />
                  </Field>
                ))}
              </>}

              {n.type==="end" && <>
                <Field label="End Message">
                  <Input value={n.data.endMessage} onChange={v=>up({endMessage:v})} placeholder="Workflow complete!" />
                </Field>
                <Field label="Generate Summary Report">
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div onClick={()=>up({summaryFlag:!n.data.summaryFlag})}
                      style={{width:40,height:22,borderRadius:11,background:n.data.summaryFlag?"#22d3ee":"rgba(148,163,184,0.18)",cursor:"pointer",position:"relative",transition:"background 0.3s"}}>
                      <div style={{position:"absolute",top:3,left:n.data.summaryFlag?21:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.3s"}} />
                    </div>
                    <span style={{fontSize:12,color:"rgba(148,163,184,0.6)"}}>{n.data.summaryFlag?"Enabled":"Disabled"}</span>
                  </div>
                </Field>
              </>}

              <button onClick={saveNodeEdit}
                style={{width:"100%",background:`linear-gradient(135deg,${cfg.color}15,${cfg.color}30)`,border:`1px solid ${cfg.color}55`,borderRadius:8,color:cfg.color,cursor:"pointer",padding:"10px",fontSize:12,fontWeight:700,marginTop:8,letterSpacing:0.5}}>
                SAVE CHANGES
              </button>
              <button onClick={deleteSelected}
                style={{width:"100%",background:"rgba(248,113,113,0.07)",border:"1px solid rgba(248,113,113,0.22)",borderRadius:8,color:"#f87171",cursor:"pointer",padding:"8px",fontSize:12,marginTop:8}}>
                🗑 Delete Node
              </button>
            </>
          ) : (
            /* history tab */
            <div>
              {nh.length===0 ? (
                <div style={{textAlign:"center",padding:"32px 10px",color:"rgba(148,163,184,0.25)",fontSize:12}}>
                  No edit history yet.<br/>Changes are tracked as you type.
                </div>
              ) : (
                [...nh].reverse().map((h,i)=>(
                  <div key={i} style={{marginBottom:10,background:"rgba(15,23,42,0.5)",border:"1px solid rgba(148,163,184,0.08)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:9,color:"rgba(148,163,184,0.35)",fontFamily:"'DM Mono', monospace",marginBottom:5}}>{h.ts}{i===0?" (latest)":""}</div>
                    {Object.entries(h.data)
                      .filter(([,v])=>typeof v==="string"||typeof v==="number"||typeof v==="boolean")
                      .map(([k,v])=>(
                        <div key={k} style={{fontSize:10,color:"rgba(148,163,184,0.5)",marginBottom:2}}>
                          <span style={{color:cfg.color,fontFamily:"'DM Mono', monospace"}}>{k}:</span> {String(v).slice(0,28)}
                        </div>
                      ))}
                    <button onClick={()=>{updateNode(n.id,h.data);saveHistory(nodes,edges);}}
                      style={{marginTop:6,background:"rgba(34,211,238,0.07)",border:"1px solid rgba(34,211,238,0.18)",borderRadius:5,color:"#22d3ee",cursor:"pointer",padding:"4px 10px",fontSize:10}}>
                      ↩ Restore
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── SANDBOX PANEL ─────────────────────────────────────────────────────────────
  const renderSandbox = () => (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",backdropFilter:"blur(10px)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#080f1e",border:"1px solid rgba(148,163,184,0.1)",borderRadius:18,width:580,maxHeight:"85vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 30px 80px rgba(0,0,0,0.7)"}}>
        <div style={{padding:"22px 26px",borderBottom:"1px solid rgba(148,163,184,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:"#e2e8f0",fontFamily:"'Sora',sans-serif"}}>⚗️ Workflow Sandbox</div>
            <div style={{fontSize:10,color:"rgba(148,163,184,0.35)",marginTop:2,fontFamily:"'DM Mono',monospace"}}>simulate · validate · predict</div>
          </div>
          <button onClick={()=>setShowSandbox(false)} style={{background:"none",border:"none",color:"rgba(148,163,184,0.35)",cursor:"pointer",fontSize:20}}>✕</button>
        </div>

        {/* analytics strip */}
        <div style={{padding:"14px 26px",borderBottom:"1px solid rgba(148,163,184,0.05)",display:"flex",gap:16}}>
          {[
            {label:"Complexity",    value:complexity.label,            color:complexity.color},
            {label:"Est. Duration", value:complexity.estimatedDuration, color:"#a78bfa"},
            {label:"Parallel",      value:`${complexity.parallelPaths} paths`, color:"#22d3ee"},
            {label:"SLA Risks",     value:slaBreaches.length,          color:slaBreaches.length>0?"#f87171":"#34d399"},
          ].map(s=>(
            <div key={s.label} style={{flex:1}}>
              <div style={{fontSize:17,fontWeight:700,color:s.color,fontFamily:"'DM Mono',monospace"}}>{s.value}</div>
              <div style={{fontSize:9,color:"rgba(148,163,184,0.3)",textTransform:"uppercase",letterSpacing:1}}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{padding:"20px 26px",overflowY:"auto",flex:1}}>
          {simResult?.errors?.length>0 && (
            <div style={{background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:10,padding:16,marginBottom:18}}>
              <div style={{fontSize:11,fontWeight:700,color:"#f87171",marginBottom:8}}>⚠ Validation Issues</div>
              {simResult.errors.map((e,i)=><div key={i} style={{fontSize:12,color:"rgba(248,113,113,0.72)",marginBottom:4}}>• {e}</div>)}
            </div>
          )}
          {slaBreaches.length>0 && (
            <div style={{background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.18)",borderRadius:10,padding:16,marginBottom:18}}>
              <div style={{fontSize:11,fontWeight:700,color:"#fbbf24",marginBottom:8}}>🕐 SLA Predictions</div>
              {slaBreaches.map((b,i)=>(
                <div key={i} style={{fontSize:12,color:b.severity==="BREACH"?"#f87171":"rgba(251,191,36,0.8)",marginBottom:4}}>
                  {b.severity==="BREACH"?"🔴":b.severity==="RISK"?"🟡":"🟡"} {b.label} — {b.severity==="BREACH"?`${Math.abs(b.daysLeft)}d overdue`:b.severity==="RISK"?"auto-approve threshold risk":`${b.daysLeft}d remaining`}
                </div>
              ))}
            </div>
          )}
          {simResult?.steps && (
            <div>
              <div style={{fontSize:9,fontWeight:700,color:"rgba(148,163,184,0.35)",textTransform:"uppercase",letterSpacing:1.2,marginBottom:14}}>Execution Timeline</div>
              {simResult.steps.map((step,i)=>{
                const cfg=NODE_CONFIGS[step.type]||NODE_CONFIGS.task;
                const active=i<=simStep;
                return (
                  <div key={step.id} style={{display:"flex",gap:14,marginBottom:14,opacity:active?1:0.22,transition:"opacity 0.5s"}}>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                      <div style={{width:34,height:34,borderRadius:"50%",background:active?cfg.bg:"rgba(30,41,59,0.35)",border:`2px solid ${active?cfg.color:"rgba(148,163,184,0.12)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>
                        {active?cfg.icon:"○"}
                      </div>
                      {i<simResult.steps.length-1&&<div style={{width:2,flex:1,minHeight:20,background:active?`linear-gradient(${cfg.color}88,rgba(148,163,184,0.04))`:"rgba(148,163,184,0.07)",marginTop:4}}/>}
                    </div>
                    <div style={{paddingTop:5,flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:active?cfg.color:"rgba(148,163,184,0.25)",fontFamily:"'Sora',sans-serif"}}>{step.label}</div>
                      <div style={{fontSize:11,color:"rgba(148,163,184,0.4)",marginTop:2}}>{step.message}</div>
                      {active&&<div style={{fontSize:10,color:"#34d399",marginTop:4}}>✓ Processed at {new Date().toLocaleTimeString()}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!simResult && (
            <div style={{textAlign:"center",padding:"50px 20px",color:"rgba(148,163,184,0.25)"}}>
              <div style={{fontSize:44,marginBottom:16}}>🚀</div>
              <div style={{fontSize:14,fontFamily:"'Sora',sans-serif"}}>Run simulation to validate your workflow</div>
              <div style={{fontSize:11,marginTop:8,color:"rgba(148,163,184,0.18)"}}>Includes SLA predictions & structural analysis</div>
            </div>
          )}
        </div>

        <div style={{padding:"18px 26px",borderTop:"1px solid rgba(148,163,184,0.07)"}}>
          <button onClick={runSimulation} disabled={simRunning}
            style={{width:"100%",background:simRunning?"rgba(34,211,238,0.07)":"linear-gradient(135deg,#22d3ee,#0ea5e9)",border:"none",borderRadius:10,color:simRunning?"#22d3ee":"#080f1e",cursor:simRunning?"wait":"pointer",padding:"13px",fontSize:14,fontWeight:700,fontFamily:"'Sora',sans-serif",letterSpacing:0.5}}>
            {simRunning?"⏳ Simulating…":"▶ Run Simulation"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── NL GENERATOR PANEL ────────────────────────────────────────────────────────
  const renderNLPanel = () => (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",backdropFilter:"blur(10px)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#080f1e",border:"1px solid rgba(99,102,241,0.28)",borderRadius:18,width:520,padding:32,boxShadow:"0 30px 80px rgba(0,0,0,0.7)"}}>
        <div style={{marginBottom:22}}>
          <div style={{fontSize:19,fontWeight:700,color:"#e2e8f0",fontFamily:"'Sora',sans-serif",marginBottom:5}}>✨ Generate from Description</div>
          <div style={{fontSize:12,color:"rgba(148,163,184,0.45)"}}>Describe an HR workflow in plain English — AI generates the full graph instantly.</div>
        </div>
        <div style={{background:"rgba(99,102,241,0.05)",border:"1px solid rgba(99,102,241,0.18)",borderRadius:10,padding:2,marginBottom:8}}>
          <textarea value={nlPrompt} onChange={e=>setNlPrompt(e.target.value)} rows={6}
            placeholder={`e.g. "A performance review where an employee submits self-assessment, manager reviews, HR approves the final rating, then the system sends a confirmation email"\n\nor: "A 3-step document verification process with background check"`}
            style={{width:"100%",background:"none",border:"none",padding:"12px 14px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Sora',sans-serif",lineHeight:1.65,boxSizing:"border-box",resize:"none"}} />
        </div>
        {nlError && <div style={{fontSize:12,color:"#f87171",marginBottom:10,padding:"8px 12px",background:"rgba(248,113,113,0.07)",borderRadius:8}}>⚠ {nlError}</div>}
        <div style={{fontSize:10,color:"rgba(148,163,184,0.28)",marginBottom:18}}>💡 Mention roles, approval chains, automations, or conditions for richer results</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>{setShowNLPanel(false);setNlError("");setNlPrompt("");}}
            style={{flex:1,background:"none",border:"1px solid rgba(148,163,184,0.12)",borderRadius:10,color:"rgba(148,163,184,0.5)",cursor:"pointer",padding:"12px",fontSize:13,fontFamily:"'Sora',sans-serif"}}>
            Cancel
          </button>
          <button onClick={generateFromNL} disabled={nlLoading||!nlPrompt.trim()}
            style={{flex:2,background:nlLoading?"rgba(99,102,241,0.12)":"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:10,color:nlLoading?"#a78bfa":"#fff",cursor:nlLoading||!nlPrompt.trim()?"not-allowed":"pointer",padding:"12px",fontSize:13,fontWeight:700,fontFamily:"'Sora',sans-serif"}}>
            {nlLoading?"✨ Generating…":"✨ Generate Workflow"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── TEMPLATES PANEL ───────────────────────────────────────────────────────────
  const renderTemplates = () => (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",backdropFilter:"blur(8px)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#080f1e",border:"1px solid rgba(148,163,184,0.1)",borderRadius:18,width:440,padding:28,boxShadow:"0 25px 70px rgba(0,0,0,0.7)"}}>
        <div style={{fontSize:17,fontWeight:700,color:"#e2e8f0",fontFamily:"'Sora',sans-serif",marginBottom:5}}>📋 Workflow Templates</div>
        <div style={{fontSize:11,color:"rgba(148,163,184,0.35)",marginBottom:20}}>Load a pre-built HR workflow to get started fast</div>
        {Object.entries(WORKFLOW_TEMPLATES).map(([key,t])=>(
          <div key={key} onClick={()=>loadTemplate(key)}
            style={{background:"rgba(148,163,184,0.03)",border:"1px solid rgba(148,163,184,0.09)",borderRadius:12,padding:"15px 18px",marginBottom:10,cursor:"pointer",transition:"all 0.2s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(99,102,241,0.38)";e.currentTarget.style.background="rgba(99,102,241,0.07)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(148,163,184,0.09)";e.currentTarget.style.background="rgba(148,163,184,0.03)";}}>
            <div style={{fontSize:14,fontWeight:600,color:"#e2e8f0",fontFamily:"'Sora',sans-serif"}}>{t.name}</div>
            <div style={{fontSize:10,color:"rgba(148,163,184,0.35)",marginTop:4,fontFamily:"'DM Mono',monospace"}}>{t.nodes.length} nodes · {t.edges.length} edges</div>
          </div>
        ))}
        <button onClick={()=>setShowTemplates(false)}
          style={{width:"100%",marginTop:4,background:"none",border:"1px solid rgba(148,163,184,0.1)",borderRadius:10,color:"rgba(148,163,184,0.4)",cursor:"pointer",padding:"10px",fontSize:12,fontFamily:"'Sora',sans-serif"}}>
          Cancel
        </button>
      </div>
    </div>
  );

  // ─── MAIN RENDER ──────────────────────────────────────────────────────────────
  return (
    <div style={{width:"100vw",height:"100vh",background:"#05090f",display:"flex",flexDirection:"column",fontFamily:"'Sora','Inter',sans-serif",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes dashMove { to { stroke-dashoffset: -20; } }
        @keyframes pulse { 0%,100%{opacity:1;r:5}50%{opacity:0.4;r:7} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)} }
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.14);border-radius:2px}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.4)}
        *{box-sizing:border-box}
        select option{background:#0a1628}
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{height:54,background:"rgba(8,15,30,0.97)",borderBottom:"1px solid rgba(148,163,184,0.06)",display:"flex",alignItems:"center",paddingInline:20,gap:12,flexShrink:0,backdropFilter:"blur(14px)",zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,borderRadius:9,background:"linear-gradient(135deg,#22d3ee,#6366f1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>⚡</div>
          <span style={{fontSize:14,fontWeight:700,color:"#e2e8f0",fontFamily:"'DM Mono',monospace",letterSpacing:-0.2}}>FlowForge</span>
          <span style={{fontSize:9,color:"rgba(148,163,184,0.25)",fontFamily:"'DM Mono',monospace"}}>/&nbsp;hr-workflow-designer</span>
        </div>

        <div style={{flex:1}}/>

        {/* complexity badge */}
        <div style={{background:`${complexity.color}12`,border:`1px solid ${complexity.color}3a`,borderRadius:7,padding:"4px 11px",display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:complexity.color,boxShadow:`0 0 6px ${complexity.color}`}}/>
          <span style={{fontSize:11,color:complexity.color,fontFamily:"'DM Mono',monospace"}}>{complexity.label}</span>
          <span style={{fontSize:10,color:"rgba(148,163,184,0.25)",fontFamily:"'DM Mono',monospace"}}>{complexity.score}/100</span>
        </div>

        <div style={{width:1,height:22,background:"rgba(148,163,184,0.07)"}}/>

        <button onClick={()=>setShowTemplates(true)}
          style={{background:"rgba(148,163,184,0.05)",border:"1px solid rgba(148,163,184,0.1)",borderRadius:7,color:"rgba(148,163,184,0.55)",cursor:"pointer",padding:"5px 12px",fontSize:12}}>
          📋 Templates
        </button>
        <button onClick={()=>setShowNLPanel(true)}
          style={{background:"linear-gradient(135deg,rgba(99,102,241,0.14),rgba(139,92,246,0.14))",border:"1px solid rgba(99,102,241,0.28)",borderRadius:7,color:"#a78bfa",cursor:"pointer",padding:"5px 13px",fontSize:12,fontWeight:600}}>
          ✨ Generate
        </button>

        <div style={{width:1,height:22,background:"rgba(148,163,184,0.07)"}}/>

        <button onClick={undo} disabled={historyIndex<=0} title="Undo (⌘Z)"
          style={{background:"none",border:"1px solid rgba(148,163,184,0.1)",borderRadius:6,color:historyIndex<=0?"rgba(148,163,184,0.18)":"rgba(148,163,184,0.6)",cursor:historyIndex<=0?"not-allowed":"pointer",padding:"4px 10px",fontSize:12}}>↩</button>
        <button onClick={redo} disabled={historyIndex>=history.length-1} title="Redo (⌘Y)"
          style={{background:"none",border:"1px solid rgba(148,163,184,0.1)",borderRadius:6,color:historyIndex>=history.length-1?"rgba(148,163,184,0.18)":"rgba(148,163,184,0.6)",cursor:historyIndex>=history.length-1?"not-allowed":"pointer",padding:"4px 10px",fontSize:12}}>↪</button>

        <div style={{width:1,height:22,background:"rgba(148,163,184,0.07)"}}/>

        <div style={{position:"relative"}}>
          <button onClick={()=>setShowExport(!showExport)}
            style={{background:"rgba(148,163,184,0.05)",border:"1px solid rgba(148,163,184,0.1)",borderRadius:7,color:"rgba(148,163,184,0.55)",cursor:"pointer",padding:"5px 12px",fontSize:12}}>⬇ Export</button>
          {showExport && (
            <div style={{position:"absolute",top:38,right:0,background:"#0a1628",border:"1px solid rgba(148,163,184,0.1)",borderRadius:10,padding:6,zIndex:50,minWidth:155,animation:"fadeIn 0.15s ease",boxShadow:"0 8px 28px rgba(0,0,0,0.55)"}}>
              <button onClick={()=>{exportWorkflow();setShowExport(false);}}
                style={{display:"block",width:"100%",background:"none",border:"none",color:"rgba(226,232,240,0.7)",cursor:"pointer",padding:"8px 14px",fontSize:12,textAlign:"left",borderRadius:6}}>
                📄 Export as JSON
              </button>
            </div>
          )}
        </div>

        <label style={{background:"rgba(148,163,184,0.05)",border:"1px solid rgba(148,163,184,0.1)",borderRadius:7,color:"rgba(148,163,184,0.55)",cursor:"pointer",padding:"5px 12px",fontSize:12}}>
          ⬆ Import <input type="file" accept=".json" onChange={importWorkflow} style={{display:"none"}}/>
        </label>

        <button onClick={()=>{setShowSandbox(true);setSimResult(null);setSimStep(-1);}}
          style={{background:"linear-gradient(135deg,rgba(34,211,238,0.12),rgba(6,182,212,0.12))",border:"1px solid rgba(34,211,238,0.28)",borderRadius:7,color:"#22d3ee",cursor:"pointer",padding:"5px 16px",fontSize:12,fontWeight:700}}>
          ▶ Test Workflow
        </button>
      </div>

      {/* ── BODY ── */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>

        {/* SIDEBAR */}
        <div style={{width:208,background:"rgba(8,15,30,0.96)",borderRight:"1px solid rgba(148,163,184,0.06)",display:"flex",flexDirection:"column",flexShrink:0,backdropFilter:"blur(12px)"}}>
          <div style={{padding:"14px 16px 8px",fontSize:9,fontWeight:700,color:"rgba(148,163,184,0.28)",textTransform:"uppercase",letterSpacing:1.8}}>Node Library</div>
          {Object.entries(NODE_CONFIGS).map(([type,cfg])=>(
            <div key={type} onClick={()=>addNode(type)}
              style={{margin:"3px 10px",padding:"10px 14px",background:cfg.bg,border:`1px solid ${cfg.border}18`,borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",gap:10,transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=cfg.border+"55";e.currentTarget.style.transform="translateX(2px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=cfg.border+"18";e.currentTarget.style.transform="translateX(0)";}}>
              <span style={{fontSize:16}}>{cfg.icon}</span>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:cfg.color}}>{cfg.label}</div>
                <div style={{fontSize:9,color:"rgba(148,163,184,0.28)",fontFamily:"'DM Mono',monospace"}}>click to add</div>
              </div>
            </div>
          ))}

          <div style={{flex:1}}/>

          {/* SLA alerts */}
          {slaBreaches.length>0 && (
            <div style={{margin:"8px 10px",padding:"10px 12px",background:"rgba(251,191,36,0.05)",border:"1px solid rgba(251,191,36,0.16)",borderRadius:10,animation:"fadeIn 0.3s ease"}}>
              <div style={{fontSize:9,fontWeight:700,color:"#fbbf24",marginBottom:5,textTransform:"uppercase",letterSpacing:1.2}}>⚠ SLA Alerts</div>
              {slaBreaches.map((b,i)=>(
                <div key={i} style={{fontSize:10,color:"rgba(251,191,36,0.62)",marginBottom:3}}>• {b.label.slice(0,22)}</div>
              ))}
            </div>
          )}

          {/* AI Suggest */}
          <div style={{padding:"10px 10px 8px",borderTop:"1px solid rgba(148,163,184,0.05)"}}>
            <button onClick={getAiSuggestion} disabled={aiLoading}
              style={{width:"100%",background:"linear-gradient(135deg,rgba(99,102,241,0.1),rgba(167,139,250,0.1))",border:"1px solid rgba(99,102,241,0.22)",borderRadius:9,color:"#a78bfa",cursor:aiLoading?"wait":"pointer",padding:"9px",fontSize:11,fontWeight:600}}>
              {aiLoading?"✨ Thinking…":"✨ AI: Suggest Next"}
            </button>
            {aiSuggestion && (
              <div style={{marginTop:10,padding:10,background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.16)",borderRadius:8,fontSize:11,color:"rgba(167,139,250,0.82)",lineHeight:1.55,animation:"fadeIn 0.3s ease"}}>
                {aiSuggestion}
              </div>
            )}
          </div>

          {/* Zoom controls */}
          <div style={{padding:"6px 10px 12px",display:"flex",gap:5}}>
            <button onClick={()=>setZoom(z=>Math.min(z*1.2,2))}
              style={{flex:1,background:"rgba(148,163,184,0.05)",border:"1px solid rgba(148,163,184,0.1)",borderRadius:6,color:"rgba(148,163,184,0.55)",cursor:"pointer",padding:"5px",fontSize:14}}>+</button>
            <button onClick={()=>{setZoom(1);setPan({x:0,y:0});}}
              style={{flex:1,background:"rgba(148,163,184,0.05)",border:"1px solid rgba(148,163,184,0.1)",borderRadius:6,color:"rgba(148,163,184,0.38)",cursor:"pointer",padding:"5px",fontSize:10,fontFamily:"'DM Mono',monospace"}}>{Math.round(zoom*100)}%</button>
            <button onClick={()=>setZoom(z=>Math.max(z*0.8,0.3))}
              style={{flex:1,background:"rgba(148,163,184,0.05)",border:"1px solid rgba(148,163,184,0.1)",borderRadius:6,color:"rgba(148,163,184,0.55)",cursor:"pointer",padding:"5px",fontSize:14}}>−</button>
          </div>
        </div>

        {/* CANVAS */}
        <div ref={canvasRef}
          onMouseMove={onCanvasMouseMove} onMouseUp={onCanvasMouseUp}
          onMouseDown={onCanvasMouseDown} onWheel={onWheel}
          style={{flex:1,position:"relative",overflow:"hidden",cursor:isPanning?"grabbing":connectingFrom?"crosshair":"default"}}>

          {/* dot grid */}
          <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
            <defs>
              <pattern id="grid" x={pan.x%(24*zoom)} y={pan.y%(24*zoom)} width={24*zoom} height={24*zoom} patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.7" fill="rgba(148,163,184,0.06)"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
          </svg>

          {connectingFrom && (
            <div style={{position:"absolute",top:14,left:"50%",transform:"translateX(-50%)",background:"rgba(34,211,238,0.1)",border:"1px solid rgba(34,211,238,0.32)",borderRadius:8,padding:"6px 18px",fontSize:12,color:"#22d3ee",pointerEvents:"none",zIndex:10,animation:"fadeIn 0.2s ease"}}>
              Click a node to connect → Esc to cancel
            </div>
          )}

          {/* edges */}
          <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",overflow:"visible"}}>
            <defs>
              <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.65"/>
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.35"/>
              </linearGradient>
            </defs>
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>{edges.map(renderEdge)}</g>
          </svg>

          {/* nodes */}
          <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",overflow:"visible"}}>
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>{nodes.map(renderNode)}</g>
          </svg>

          {/* minimap */}
          <div style={{position:"absolute",bottom:16,right:selectedNode?314:16,width:144,height:96,background:"rgba(8,15,30,0.88)",border:"1px solid rgba(148,163,184,0.08)",borderRadius:10,overflow:"hidden",backdropFilter:"blur(8px)"}}>
            <div style={{fontSize:8,color:"rgba(148,163,184,0.25)",padding:"4px 7px",fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:1.2}}>Minimap</div>
            <svg width="144" height="74" style={{display:"block"}}>
              {edges.map(e=>{
                const s=nodes.find(n=>n.id===e.source),t=nodes.find(n=>n.id===e.target);
                if(!s||!t) return null;
                return <line key={e.id} x1={(s.position.x/900)*134+5} y1={(s.position.y/600)*64+5}
                  x2={(t.position.x/900)*134+5} y2={(t.position.y/600)*64+5}
                  stroke="rgba(148,163,184,0.15)" strokeWidth="1"/>;
              })}
              {nodes.map(n=>{
                const cfg=NODE_CONFIGS[n.type];
                return <rect key={n.id} x={(n.position.x/900)*134+3} y={(n.position.y/600)*64+3}
                  width="14" height="10" rx="2" fill={cfg.color} opacity="0.6"/>;
              })}
            </svg>
          </div>

          {/* stats */}
          <div style={{position:"absolute",bottom:16,left:16,display:"flex",gap:7}}>
            {[
              {label:"Nodes",     value:nodes.length,                          color:"#22d3ee"},
              {label:"Edges",     value:edges.length,                          color:"#a78bfa"},
              {label:"Errors",    value:Object.keys(validationErrors).length,  warn:Object.keys(validationErrors).length>0},
              {label:"SLA Risks", value:slaBreaches.length,                    warn:slaBreaches.length>0},
            ].map(s=>(
              <div key={s.label} style={{background:"rgba(8,15,30,0.86)",border:`1px solid ${s.warn&&s.value>0?"rgba(248,113,113,0.22)":"rgba(148,163,184,0.07)"}`,borderRadius:7,padding:"4px 11px",backdropFilter:"blur(8px)"}}>
                <span style={{fontSize:15,fontWeight:700,color:s.warn&&s.value>0?"#f87171":s.color||"#e2e8f0",fontFamily:"'DM Mono',monospace"}}>{s.value}</span>
                <span style={{fontSize:9,color:"rgba(148,163,184,0.3)",marginLeft:4,textTransform:"uppercase",letterSpacing:0.6}}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* keyboard hints */}
          <div style={{position:"absolute",top:14,right:14,display:"flex",gap:5}}>
            {[["Del","delete"],["Esc","deselect"],["Scroll","zoom"],["Drag","pan"]].map(([k,v])=>(
              <div key={k} style={{background:"rgba(8,15,30,0.7)",border:"1px solid rgba(148,163,184,0.07)",borderRadius:5,padding:"3px 8px",fontSize:9,color:"rgba(148,163,184,0.25)",fontFamily:"'DM Mono',monospace"}}>
                <span style={{color:"rgba(148,163,184,0.45)"}}>{k}</span> {v}
              </div>
            ))}
          </div>
        </div>

        {/* NODE CONFIG PANEL */}
        {selectedNode && (
          <div style={{width:300,background:"rgba(8,15,30,0.97)",borderLeft:"1px solid rgba(148,163,184,0.06)",padding:20,display:"flex",flexDirection:"column",animation:"slideIn 0.2s ease",backdropFilter:"blur(14px)"}}>
            <div style={{fontSize:9,fontWeight:700,color:"rgba(148,163,184,0.28)",textTransform:"uppercase",letterSpacing:1.8,marginBottom:14}}>Node Configuration</div>
            {renderNodeForm()}
          </div>
        )}
      </div>

      {/* MODALS */}
      {showSandbox  && renderSandbox()}
      {showNLPanel  && renderNLPanel()}
      {showTemplates && renderTemplates()}
    </div>
  );
}
