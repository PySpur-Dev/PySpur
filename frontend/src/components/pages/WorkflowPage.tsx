import React from 'react';
import dynamic from 'next/dynamic';
import Header from '../Header';
import { PersistGate } from 'redux-persist/integration/react';
import { persistor } from '../../store/store';

// Use dynamic import for FlowCanvas to avoid SSR issues
const FlowCanvas = dynamic(() => import('../canvas/FlowCanvas'), {
  ssr: false,
});

const WorkflowPage: React.FC = () => {
  return (
    <PersistGate loading={null} persistor={persistor}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header activePage="workflow" />
        <div style={{ flexGrow: 1 }}>
          <FlowCanvas />
        </div>
      </div>
    </PersistGate>
  );
};

export default WorkflowPage;