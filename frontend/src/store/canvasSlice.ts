import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  NodeChange,
  EdgeChange,
  Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { createNode } from '../utils/nodeFactory';
import { WorkflowDefinition, WorkflowNodeCoordinates } from '@/types/api_types/workflowSchemas';

// Minimal node structure for canvas rendering
export interface CanvasNode {
  id: string;
  type: string;
  position: WorkflowNodeCoordinates;
  data: {
    title: string;
    acronym: string;
    color: string;
  };
  measured?: {
    width: number;
    height: number;
  };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  selected?: boolean;
}

interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeId: string | null;
  workflowId: string | null;
  projectName: string;
  sidebarWidth: number;
  history: {
    past: Array<{ nodes: CanvasNode[], edges: CanvasEdge[] }>;
    future: Array<{ nodes: CanvasNode[], edges: CanvasEdge[] }>;
  };
}

const initialState: CanvasState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
  workflowId: null,
  projectName: 'Untitled Project',
  sidebarWidth: 400,
  history: {
    past: [],
    future: []
  }
};

const saveToHistory = (state: CanvasState) => {
  state.history.past.push({
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    edges: JSON.parse(JSON.stringify(state.edges))
  });
  state.history.future = [];
};

const canvasSlice = createSlice({
  name: 'canvas',
  initialState,
  reducers: {
    initializeCanvas: (state, action: PayloadAction<{
      workflowId: string;
      definition: WorkflowDefinition;
      name: string;
      nodeTypes: any;
    }>) => {
      const { workflowId, definition, name } = action.payload;
      state.workflowId = workflowId;
      state.projectName = name;

      const { nodes, links } = definition;
      state.nodes = nodes.map(node => {
        const createdNode = createNode(action.payload.nodeTypes, node.node_type, node.id, { x: node.coordinates.x, y: node.coordinates.y });
        return createdNode ? {
          ...createdNode,
          data: {
            title: node.id,
            acronym: createdNode.data.acronym,
            color: createdNode.data.color
          }
        } : null;
      }).filter((node): node is CanvasNode => node !== null);

      state.edges = links.map(link => ({
        id: uuidv4(),
        source: link.source_id,
        target: link.target_id,
        sourceHandle: state.nodes.find(node => node.id === link.source_id)?.data?.title,
        targetHandle: state.nodes.find(node => node.id === link.target_id)?.data?.title,
      }));
    },

    canvasNodesChange: (state, action: PayloadAction<NodeChange[]>) => {
      state.nodes = applyNodeChanges(action.payload, state.nodes) as CanvasNode[];
    },

    canvasEdgesChange: (state, action: PayloadAction<EdgeChange[]>) => {
      state.edges = applyEdgeChanges(action.payload, state.edges) as CanvasEdge[];
    },

    connectEdge: (state, action: PayloadAction<Connection>) => {
      saveToHistory(state);
      const newEdge = {
        ...action.payload,
        id: uuidv4(),
        targetHandle: action.payload.sourceHandle
      };
      state.edges = addEdge(newEdge, state.edges);
    },

    addCanvasNode: (state, action: PayloadAction<CanvasNode>) => {
      saveToHistory(state);
      state.nodes.push(action.payload);
    },

    setSelectedNodeId: (state, action: PayloadAction<string | null>) => {
      state.selectedNodeId = action.payload;
    },

    deleteCanvasNode: (state, action: PayloadAction<string>) => {
      saveToHistory(state);
      const nodeId = action.payload;
      state.nodes = state.nodes.filter((n) => n.id !== nodeId);
      state.edges = state.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      );
      if (state.selectedNodeId === nodeId) {
        state.selectedNodeId = null;
      }
    },

    deleteCanvasEdge: (state, action: PayloadAction<string>) => {
      saveToHistory(state);
      state.edges = state.edges.filter((edge) => edge.id !== action.payload);
    },

    setSidebarWidth: (state, action: PayloadAction<number>) => {
      state.sidebarWidth = action.payload;
    },

    setProjectName: (state, action: PayloadAction<string>) => {
      state.projectName = action.payload;
    },

    clearCanvas: (state) => {
      state.nodes = [];
      state.edges = [];
      state.selectedNodeId = null;
    },

    undo: (state) => {
      const previous = state.history.past.pop();
      if (previous) {
        state.history.future.push({
          nodes: JSON.parse(JSON.stringify(state.nodes)),
          edges: JSON.parse(JSON.stringify(state.edges))
        });
        state.nodes = previous.nodes;
        state.edges = previous.edges;
      }
    },

    redo: (state) => {
      const next = state.history.future.pop();
      if (next) {
        state.history.past.push({
          nodes: JSON.parse(JSON.stringify(state.nodes)),
          edges: JSON.parse(JSON.stringify(state.edges))
        });
        state.nodes = next.nodes;
        state.edges = next.edges;
      }
    },

    updateNodeTitle: (state, action: PayloadAction<{ nodeId: string; newTitle: string }>) => {
      const { nodeId, newTitle } = action.payload;
      const node = state.nodes.find(node => node.id === nodeId);
      if (node) {
        node.data.title = newTitle;
      }

      // Update edges where this node is source or target
      state.edges = state.edges.map(edge => {
        if (edge.source === nodeId) {
          return { ...edge, sourceHandle: newTitle, targetHandle: newTitle };
        }
        return edge;
      });
    },
  },
});

export const {
  initializeCanvas,
  canvasNodesChange,
  canvasEdgesChange,
  connectEdge,
  addCanvasNode,
  setSelectedNodeId,
  deleteCanvasNode,
  deleteCanvasEdge,
  setSidebarWidth,
  setProjectName,
  clearCanvas,
  undo,
  redo,
  updateNodeTitle,
} = canvasSlice.actions;

export default canvasSlice.reducer;

export const selectNodeById = (state: { canvas: CanvasState }, nodeId: string): CanvasNode | undefined => {
  return state.canvas.nodes.find((node) => node.id === nodeId);
};