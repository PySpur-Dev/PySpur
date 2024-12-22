import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useDispatch } from 'react-redux';
import { getWorkflow } from '../../utils/api';
import { initializeCanvas, setProjectName } from '../../store/canvasSlice';
import { setTestInputs, TestInput } from '../../store/nodeDataSlice';
import WorkflowPage from '../../components/pages/WorkflowPage';
import { v4 as uuidv4 } from 'uuid';

const WorkflowDetailPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const dispatch = useDispatch();

  useEffect(() => {
    const fetchWorkflow = async () => {
      if (!id) return;

      try {
        const data = await getWorkflow(id as string);

        // Initialize canvas with workflow data
        dispatch(initializeCanvas({
          workflowId: id as string,
          definition: data.definition,
          name: data.name,
          nodeTypes: {} // This will be handled by the nodeTypes slice
        }));

        // Set project name
        dispatch(setProjectName(data.name));

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
      }
    };

    fetchWorkflow();
  }, [id, dispatch]);

  return <WorkflowPage />;
};

export default WorkflowDetailPage;