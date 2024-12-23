import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import canvasReducer from './canvasSlice';
import { CanvasNode, CanvasEdge, CanvasHistory } from './canvasSlice';
import nodeTypesReducer from './nodeTypesSlice';
import nodeDataReducer, { NodeConfigData, TestInput } from './nodeDataSlice';
import userPreferencesReducer from './userPreferencesSlice';
import panelReducer from './panelSlice';
import { NodeMetadata } from './nodeTypesSlice';

// Define the RootState type
export interface RootState {
  canvas: {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
    selectedNodeId: string | null;
    workflowId: string | null;
    projectName: string;
    sidebarWidth: number;
    history: CanvasHistory;
  };
  nodeData: {
    nodeDataById: {
      [nodeId: string]: NodeConfigData;
    };
    testInputs: TestInput[];
  };
  nodeTypes: {
    data: Record<string, any>;
    metadata: Record<string, NodeMetadata[]>;
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
  };
  userPreferences: {
    hasSeenWelcome: boolean;
  }
  panel: {
    isNodePanelExpanded: boolean;
  };
}

// Define the persist config
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['canvas', 'nodeData', 'nodeTypes', 'userPreferences'],
};

const rootReducer = combineReducers({
  canvas: canvasReducer,
  nodeData: nodeDataReducer,
  nodeTypes: nodeTypesReducer,
  userPreferences: userPreferencesReducer,
  panel: panelReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

// Define store types
export type AppStore = typeof store;
export type AppDispatch = typeof store.dispatch;
export const persistor = persistStore(store);
export default store;
