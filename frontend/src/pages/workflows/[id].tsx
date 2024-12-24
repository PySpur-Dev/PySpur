import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import dynamic from 'next/dynamic';
import { PersistGate } from 'redux-persist/integration/react';
import { persistor } from '../../store/store';
import { getWorkflow } from '../../utils/api';
import { initializeCanvas, setProjectName } from '../../store/canvasSlice';
import { setTestInputs, TestInput, updateNodeData } from '../../store/nodeDataSlice';
import { fetchNodeTypes } from '../../store/nodeTypesSlice';
import Header from '../../components/Header';
import LoadingSpinner from '../../components/LoadingSpinner';
import { AppDispatch, RootState } from '../../store/store';

// Use dynamic import for FlowCanvas to avoid SSR issues
const FlowCanvas = dynamic(() => import('../../components/canvas/FlowCanvas'), {
  ssr: false,
});

const WorkflowDetailPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const dispatch = useDispatch<AppDispatch>();
  const [isLoading, setIsLoading] = useState(true);
  const nodeTypes = useSelector((state: RootState) => state.nodeTypes.data);
  const nodeTypesStatus = useSelector((state: RootState) => state.nodeTypes.status);

  useEffect(() => {
    dispatch(fetchNodeTypes());
  }, [dispatch]);

  useEffect(() => {
    const fetchWorkflow = async () => {
      if (!id || nodeTypesStatus !== 'succeeded') return;

      try {
        const data = await getWorkflow(id as string);
        console.log('Fetched workflow data:', data);
        console.log('Current nodeTypes:', nodeTypes);

        // Initialize canvas with workflow data
        dispatch(initializeCanvas({
          workflowId: id as string,
          definition: data.definition,
          name: data.name,
          nodeTypes: nodeTypes
        }));

        // Set project name
        dispatch(setProjectName(data.name));

        // Update node data store with configurations
        data.definition.nodes.forEach(node => {
          dispatch(updateNodeData({
            nodeId: node.id,
            newConfigFields: {
              config: node.config.config || {},
              output_schema: node.config.output_schema || {},
              input_schema: node.config.input_schema || {},
              node_type: node.node_type
            }
          }));
        });

        // Convert and set test inputs if they exist
        if (data.definition?.test_inputs) {
          const storeTestInputs: TestInput[] = data.definition.test_inputs.map(input => ({
            ...input,
            id: typeof input.id === 'number' ? input.id.toString() : input.id
          }));
          dispatch(setTestInputs(storeTestInputs));
        }
      } catch (error) {
        console.error('Error fetching workflow:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflow();
  }, [id, dispatch, nodeTypes, nodeTypesStatus]);

  if (isLoading || nodeTypesStatus !== 'succeeded') {
    return <LoadingSpinner />;
  }

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

export default WorkflowDetailPage;