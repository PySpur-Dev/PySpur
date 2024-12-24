// store/nodeDataSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface TestInput {
  id: string;
  [key: string]: any;
}

export interface NodeConfigData {
  config: {
    title?: string;
    type?: string;
    output_schema?: Record<string, any>;
    llm_info?: {
      model?: string;
      max_tokens?: number;
      temperature?: number;
      top_p?: number;
      [key: string]: any;
    };
    system_message?: string;
    user_message?: string;
    few_shot_examples?: Record<string, any>[] | null;
    enforce_schema?: boolean;
    [key: string]: any;
  };
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
  node_type?: string;
  run?: Record<string, any>;
  taskStatus?: string;
}

interface NodeDataState {
  nodeDataById: {
    [nodeId: string]: NodeConfigData;
  };
  testInputs: TestInput[];
}

const initialState: NodeDataState = {
  nodeDataById: {},
  testInputs: [],
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
      state.nodeDataById[nodeId] = {
        config: data.config || {},
        input_schema: data.input_schema || {},
        output_schema: data.output_schema || {},
        node_type: data.node_type,
        run: data.run,
        taskStatus: data.taskStatus
      };

      // Special handling for InputNode
      if (data.node_type === 'InputNode') {
        if (!state.nodeDataById[nodeId].config.output_schema) {
          state.nodeDataById[nodeId].config.output_schema = {};
        }
      }
    },

    updateNodeData: (
      state,
      action: PayloadAction<{
        nodeId: string;
        newConfigFields: Partial<NodeConfigData>;
      }>
    ) => {
      const { nodeId, newConfigFields } = action.payload;

      if (!state.nodeDataById[nodeId]) {
        // Initialize with empty objects for all required fields
        state.nodeDataById[nodeId] = {
          config: {},
          input_schema: {},
          output_schema: {},
          node_type: newConfigFields.node_type
        };
      }

      // Deep merge the configuration
      state.nodeDataById[nodeId] = {
        ...state.nodeDataById[nodeId],
        ...newConfigFields,
        config: {
          ...state.nodeDataById[nodeId].config,
          ...newConfigFields.config
        },
        input_schema: {
          ...state.nodeDataById[nodeId].input_schema,
          ...newConfigFields.input_schema
        },
        output_schema: {
          ...state.nodeDataById[nodeId].output_schema,
          ...newConfigFields.output_schema
        }
      };

      // Special handling for InputNode
      if (state.nodeDataById[nodeId].node_type === 'InputNode') {
        if (!state.nodeDataById[nodeId].config.output_schema) {
          state.nodeDataById[nodeId].config.output_schema = {};
        }
      }
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

    setTestInputs: (state, action: PayloadAction<TestInput[]>) => {
      state.testInputs = action.payload;
    },

    addTestInput: (state, action: PayloadAction<TestInput>) => {
      state.testInputs.push(action.payload);
    },

    updateTestInput: (state, action: PayloadAction<{ id: string; input: Partial<TestInput> }>) => {
      const index = state.testInputs.findIndex(input => input.id === action.payload.id);
      if (index !== -1) {
        state.testInputs[index] = { ...state.testInputs[index], ...action.payload.input };
      }
    },

    deleteTestInput: (state, action: PayloadAction<string>) => {
      state.testInputs = state.testInputs.filter(input => input.id !== action.payload);
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
  resetAllNodeRuns,
  setTestInputs,
  addTestInput,
  updateTestInput,
  deleteTestInput
} = nodeDataSlice.actions;

export default nodeDataSlice.reducer;
