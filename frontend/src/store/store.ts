import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import canvasReducer from './canvasSlice';
import { CanvasNode, CanvasEdge } from './canvasSlice';
import nodeTypesReducer from './nodeTypesSlice';
import nodeDataReducer, { NodeConfigData } from './nodeDataSlice';
import userPreferencesReducer from './userPreferencesSlice';
import panelReducer from './panelSlice';

// Define the RootState type
export interface RootState {
  canvas: {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
    selectedNodeId: string | null;
    workflowId: string | null;
    projectName: string;
    sidebarWidth: number;
  };
  nodeData: {
    nodeDataById: {
      [nodeId: string]: NodeConfigData;
    };
  };
  nodeTypes: {
    data: Record<string, any>;
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
