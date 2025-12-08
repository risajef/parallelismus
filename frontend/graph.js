const relationTypeInput = document.getElementById("relationType");
const limitInput = document.getElementById("limit");
const layoutSelect = document.getElementById("layout");
const refreshBtn = document.getElementById("refresh");
const statusEl = document.getElementById("graph-status");
const graphEl = document.getElementById("graph");

let network;
const palette = ["#38bdf8", "#f472b6", "#facc15", "#4ade80", "#a78bfa", "#fb7185", "#fbbf24", "#34d399", "#60a5fa"];
const typeColor = new Map();

const setStatus = (msg, isError = false) => {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#f87171" : "#94a3b8";
};

const colorForType = (type) => {
  if (!type) return "#94a3b8";
  if (!typeColor.has(type)) {
    typeColor.set(type, palette[typeColor.size % palette.length]);
  }
  return typeColor.get(type);
};

const paramsFromControls = () => {
  const params = new URLSearchParams();
  const limitVal = parseInt(limitInput.value, 10);
  if (!Number.isNaN(limitVal) && limitVal > 0) {
    params.set("limit", String(limitVal));
  }
  const relationType = relationTypeInput.value.trim();
  if (relationType) {
    params.set("relation_type", relationType);
  }
  return params;
};

const buildGraphData = (relations) => {
  const nodes = [];
  const edges = [];
  const seenNodes = new Map();
  relations.forEach((rel) => {
    if (rel.source_id && !seenNodes.has(rel.source_id)) {
      seenNodes.set(rel.source_id, true);
      nodes.push({
        id: rel.source_id,
        label: rel.source_label || rel.source_id,
        title: rel.source_label || rel.source_id,
        color: "#1d4ed8",
      });
    }
    if (rel.target_id && !seenNodes.has(rel.target_id)) {
      seenNodes.set(rel.target_id, true);
      nodes.push({
        id: rel.target_id,
        label: rel.target_label || rel.target_id,
        title: rel.target_label || rel.target_id,
        color: "#9333ea",
      });
    }
    edges.push({
      id: `edge-${rel.id}`,
      from: rel.source_id,
      to: rel.target_id,
      label: rel.relation_type || "relation",
      color: { color: colorForType(rel.relation_type), opacity: 0.7 },
      font: { align: "horizontal", size: 12, color: "#cbd5f5" },
      arrows: { to: { enabled: true, scaleFactor: 0.6 } },
      smooth: { enabled: true, type: "dynamic" },
    });
  });
  return { nodes, edges };
};

const applyCircularLayout = (nodes) => {
  const nodeCount = nodes.length || 1;
  const radius = Math.max(220, nodeCount * 10);
  return nodes.map((node, idx) => {
    const angle = (2 * Math.PI * idx) / nodeCount;
    return {
      ...node,
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
      fixed: true,
    };
  });
};

const presetOptions = (layout) => {
  if (layout === "circular") {
    return {
      layout: { improvedLayout: false },
      physics: { enabled: false },
    };
  }
  if (layout === "kamada_kawai") {
    return {
      layout: { improvedLayout: true },
      physics: {
        enabled: true,
        solver: "forceAtlas2Based",
        stabilization: { fit: true, iterations: 200 },
      },
    };
  }
  return {
    layout: { improvedLayout: true },
    physics: {
      enabled: true,
      solver: "barnesHut",
      stabilization: { fit: true, iterations: 200 },
    },
  };
};

const renderNetwork = (data) => {
  const layout = layoutSelect.value;
  const options = presetOptions(layout);
  const nodes = layout === "circular" ? applyCircularLayout(data.nodes) : data.nodes;
  const visData = {
    nodes: new vis.DataSet(nodes),
    edges: new vis.DataSet(data.edges),
  };
  if (!network) {
    network = new vis.Network(graphEl, visData, options);
  } else {
    network.setOptions(options);
    network.setData(visData);
  }
  network.fit();
};

const loadGraph = async () => {
  setStatus("Loading graph…");
  const params = paramsFromControls();
  const url = `/relations/all${params.toString() ? `?${params.toString()}` : ""}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      setStatus("No relations returned for this filter.");
      renderNetwork({ nodes: [], edges: [] });
      return;
    }
    const graphData = buildGraphData(data);
    renderNetwork(graphData);
    setStatus(`Rendered ${graphData.nodes.length} nodes and ${graphData.edges.length} edges.`);
  } catch (err) {
    console.error(err);
    setStatus(`Failed to load graph: ${err.message}`, true);
  }
};

refreshBtn.addEventListener("click", () => loadGraph());
layoutSelect.addEventListener("change", () => {
  if (!network) return;
  const nodes = network.body.data.nodes.get();
  const edges = network.body.data.edges.get();
  renderNetwork({ nodes, edges });
});

loadGraph();
