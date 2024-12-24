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
    config?: any;
    run?: any;
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
  sourceHandle: string;
  targetHandle: string;
  selected?: boolean;
}

export interface CanvasHistory {
  past: Array<{ nodes: CanvasNode[], edges: CanvasEdge[] }>;
  future: Array<{ nodes: CanvasNode[], edges: CanvasEdge[] }>;
}

export interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeId: string | null;
  workflowId: string | null;
  projectName: string;
  sidebarWidth: number;
  history: CanvasHistory;
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
        const result = createNode(action.payload.nodeTypes, node.node_type, node.id, { x: node.coordinates.x, y: node.coordinates.y });
        if (result.canvasNode) {
          // Update the node data with the configuration from the workflow definition
          result.canvasNode.data = {
            ...result.canvasNode.data,
            config: node.config,
            title: node.title || node.id,
          };

          // Special handling for InputNode
          if (node.node_type === 'InputNode') {
            // Initialize output schema if it doesn't exist
            if (!result.canvasNode.data.config) {
              result.canvasNode.data.config = {};
            }
            if (!result.canvasNode.data.config.output_schema) {
              result.canvasNode.data.config.output_schema = {};
            }
          }
        }
        return result.canvasNode;
      }).filter((node): node is CanvasNode => node !== null);

      state.edges = links.map(link => {
        const sourceNode = state.nodes.find(node => node.id === link.source_id);
        const sourceTitle = sourceNode?.data?.config?.title || sourceNode?.data?.title || link.source_id;

        return {
          id: uuidv4(),
          source: link.source_id,
          target: link.target_id,
          sourceHandle: sourceTitle,
          targetHandle: sourceTitle,
        };
      });
    },

    canvasNodesChange: (state, action: PayloadAction<NodeChange[]>) => {
      state.nodes = applyNodeChanges(action.payload, state.nodes) as CanvasNode[];
    },

    canvasEdgesChange: (state, action: PayloadAction<EdgeChange[]>) => {
      state.edges = applyEdgeChanges(action.payload, state.edges) as CanvasEdge[];
    },

    connectEdge: (state, action: PayloadAction<Connection>) => {
      saveToHistory(state);
      const sourceNode = state.nodes.find(node => node.id === action.payload.source);
      const sourceTitle = sourceNode?.data?.title || action.payload.source;

      const newEdge = {
        ...action.payload,
        id: uuidv4(),
        sourceHandle: sourceTitle,
        targetHandle: sourceTitle,
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

    updateEdgesOnHandleRename: (state, action: PayloadAction<{
      nodeId: string;
      oldHandleId: string;
      newHandleId: string;
      schemaType: 'input_schema' | 'output_schema';
    }>) => {
      const { nodeId, oldHandleId, newHandleId, schemaType } = action.payload;
      saveToHistory(state);

      // Update the node's output schema if it exists
      const node = state.nodes.find(n => n.id === nodeId);
      if (node && node.data.config?.output_schema && schemaType === 'output_schema') {
        const newSchema = { ...node.data.config.output_schema };
        newSchema[newHandleId] = newSchema[oldHandleId];
        delete newSchema[oldHandleId];
        node.data.config.output_schema = newSchema;
      }

      // Update edges
      state.edges = state.edges.map((edge) => {
        if (schemaType === 'input_schema' && edge.target === nodeId && edge.targetHandle === oldHandleId) {
          return { ...edge, targetHandle: newHandleId };
        }
        if (schemaType === 'output_schema' && edge.source === nodeId && edge.sourceHandle === oldHandleId) {
          return { ...edge, sourceHandle: newHandleId, targetHandle: newHandleId };
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
  updateEdgesOnHandleRename,
} = canvasSlice.actions;

export default canvasSlice.reducer;

export const selectNodeById = (state: { canvas: CanvasState }, nodeId: string): CanvasNode | undefined => {
  return state.canvas.nodes.find((node) => node.id === nodeId);
};