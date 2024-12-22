// store/nodeDataSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface NodeConfigData {
  // The heavier fields that you need only in the sidebar, etc.
  config: {
    title?: string;
    output_schema?: Record<string, any>;
    llm_info?: Record<string, any>;
    system_message?: string;
    user_message?: string;
    few_shot_examples?: Record<string, any>[] | null;
    [key: string]: any;
  };
  run?: Record<string, any>;
  taskStatus?: string;
}

interface NodeDataState {
  nodeDataById: {
    [nodeId: string]: NodeConfigData;
  };
}

const initialState: NodeDataState = {
  nodeDataById: {},
};

const nodeDataSlice = createSlice({
  name: 'nodeData',
  initialState,
  reducers: {
    setNodeData: (
      state,
      action: PayloadAction<{ nodeId: string; data: NodeConfigData }>
    ) => {
      const { nodeId, data } = action.payload;
      state.nodeDataById[nodeId] = data;
    },

    updateNodeData: (
      state,
      action: PayloadAction<{
        nodeId: string;
        newConfigFields: { [key: string]: any };
      }>
    ) => {
      const { nodeId, newConfigFields } = action.payload;

      if (!state.nodeDataById[nodeId]) {
        // If there's no entry yet, initialize
        state.nodeDataById[nodeId] = { config: {} };
      }

      // Merge the new fields into existing config
      Object.assign(state.nodeDataById[nodeId].config, newConfigFields);
    },

    updateNodeTitle: (
      state,
      action: PayloadAction<{ nodeId: string; newTitle: string }>
    ) => {
      const { nodeId, newTitle } = action.payload;
      if (state.nodeDataById[nodeId]) {
        state.nodeDataById[nodeId].config.title = newTitle;
      }
    },

    setNodeRunData: (
      state,
      action: PayloadAction<{ nodeId: string; runData: Record<string, any> }>
    ) => {
      const { nodeId, runData } = action.payload;
      if (!state.nodeDataById[nodeId]) {
        state.nodeDataById[nodeId] = { config: {} };
      }
      state.nodeDataById[nodeId].run = runData;
    },

    setNodeTaskStatus: (
      state,
      action: PayloadAction<{ nodeId: string; status: string }>
    ) => {
      const { nodeId, status } = action.payload;
      if (!state.nodeDataById[nodeId]) {
        state.nodeDataById[nodeId] = { config: {} };
      }
      state.nodeDataById[nodeId].taskStatus = status;
    },

    deleteNodeData: (state, action: PayloadAction<string>) => {
      delete state.nodeDataById[action.payload];
    },

    resetAllNodeRuns: (state) => {
      Object.keys(state.nodeDataById).forEach(nodeId => {
        if (state.nodeDataById[nodeId]) {
          delete state.nodeDataById[nodeId].run;
          delete state.nodeDataById[nodeId].taskStatus;
        }
      });
    },
  },
});

export const {
  setNodeData,
  updateNodeData,
  updateNodeTitle,
  setNodeRunData,
  setNodeTaskStatus,
  deleteNodeData,
  resetAllNodeRuns
} = nodeDataSlice.actions;

export default nodeDataSlice.reducer;
