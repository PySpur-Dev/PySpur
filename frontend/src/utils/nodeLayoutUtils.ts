import { FlowWorkflowEdge, FlowWorkflowNode } from '@/store/canvasSlice';
import dagre from '@dagrejs/dagre';


export const getLayoutedNodes = (nodes: FlowWorkflowNode[], edges: FlowWorkflowEdge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setGraph({
    rankdir: direction,
    align: 'UL',
    edgesep: 10,
    ranksep: 128,
    nodesep: 128,
  });
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    if (node.measured) {
      dagreGraph.setNode(node.id, { width: node.measured.width, height: node.measured.height });
    }
  });

  const nodeWeights: { [key: string]: number } = {};
  const edgeWeights: { [key: string]: number } = {};

  // Initialize root nodes with weight 1024
  nodes.forEach(node => {
    const incomingEdges = edges.filter(edge => edge.target === node.id);
    if (incomingEdges.length === 0) {
      nodeWeights[node.id] = 1024;
      const outgoingEdges = edges.filter(edge => edge.source === node.id);
      outgoingEdges.forEach(edge => {
        edgeWeights[edge.id] = 512;
      });
    }
  });

  // Perform a topological sort
  let sortedNodes: FlowWorkflowNode[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (node: FlowWorkflowNode) => {
    if (visited.has(node.id)) return;
    if (visiting.has(node.id)) throw new Error('Graph has cycles');

    visiting.add(node.id);
    const outgoingEdges = edges.filter(edge => edge.source === node.id);
    outgoingEdges.forEach(edge => {
      const targetNode = nodes.find(n => n.id === edge.target);
      if (targetNode) visit(targetNode);
    });
    visiting.delete(node.id);
    visited.add(node.id);
    sortedNodes.push(node);
  };

  nodes.forEach(node => {
    if (!visited.has(node.id)) visit(node);
  });

  sortedNodes = sortedNodes.reverse();

  // Calculate weights for nodes and edges
  sortedNodes.forEach(node => {
    const incomingEdges = edges.filter(edge => edge.target === node.id);
    let maxIncomingWeight = -Infinity;

    if (incomingEdges.length > 0) {
      maxIncomingWeight = incomingEdges.reduce((maxWeight, edge) => {
        return Math.max(maxWeight, edgeWeights[edge.id] || -Infinity);
      }, -Infinity);

      nodeWeights[node.id] = (maxIncomingWeight !== -Infinity) ? maxIncomingWeight : 2;
    } else {
      nodeWeights[node.id] = 2;
    }

    const outgoingEdges = edges.filter(edge => edge.source === node.id);
    outgoingEdges.forEach(edge => {
      edgeWeights[edge.id] = nodeWeights[node.id] * 2;
    });
  });

  edges.forEach((edge) => {
    const weight = edgeWeights[edge.id] || 1;
    dagreGraph.setEdge(edge.source, edge.target, {
      weight: weight,
      height: 10,
      width: 10,
      labelpos: 'c',
      minlen: 1
    });
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) return node;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (node.measured?.width || 0) / 2,
        y: nodeWithPosition.y - (node.measured?.height || 0) / 2,
      },
    };
  });
};