import { useCallback, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { updateWorkflow } from '../utils/api';
import { RootState } from '../store/store';
import { debounce } from 'lodash';
import { WorkflowCreateRequest, WorkflowNode } from '@/types/api_types/workflowSchemas';

interface Position {
  x: number;
  y: number;
}

interface NodeData {
  config: {
    data?: {
      input_schema?: Record<string, string>;
      output_schema?: Record<string, string>;
    };
    input_schema?: Record<string, string>;
    title?: string;
  };
  title?: string;
}

interface Node {
  id: string;
  type: string;
  position: Position;
  data: NodeData;
  config?: any;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export const useSaveWorkflow = () => {
  const nodes = useSelector((state: RootState) => state.flow.nodes);
  const edges = useSelector((state: RootState) => state.flow.edges);
  const workflowID = useSelector((state: RootState) => state.flow.workflowID);
  const workflowInputVariables = useSelector((state: RootState) => state.flow.workflowInputVariables);
  const workflowName = useSelector((state: RootState) => state.flow.projectName);
  const testInputs = useSelector((state: RootState) => state.flow.testInputs);

  // Create a ref to store the current values
  const valuesRef = useRef({ nodes, edges, workflowID, workflowInputVariables, workflowName, testInputs });

  // Update the ref when values change
  useEffect(() => {
    valuesRef.current = { nodes, edges, workflowID, workflowInputVariables, workflowName, testInputs };
  }, [nodes, edges, workflowID, workflowInputVariables, workflowName, testInputs]);

  // Create the debounced save function once
  const debouncedSave = useRef(
    debounce(async () => {
      const { nodes, edges, workflowID, workflowName, testInputs } = valuesRef.current;
      
      try {
        const updatedNodes = nodes
          .filter((node): node is NonNullable<typeof node> => node !== null && node !== undefined)
          .map((node) => {
            return {
              ...node,
              config: node.data?.config,
              title: node.data?.title,
              new_id: node.data.config.title || node.data.title || node.type || 'Untitled',
            };
          });

        const updatedWorkflow: WorkflowCreateRequest = {
          name: workflowName,
          description: '',
          definition: {
            nodes: updatedNodes.map(node => ({
              id: node.new_id,
              node_type: node.type,
              config: node.config,
              coordinates: node.position,
            } as WorkflowNode)),
            links: edges.map((edge: Edge) => {
              const sourceNode = updatedNodes.find(node => node?.id === edge.source);
              const targetNode = updatedNodes.find(node => node?.id === edge.target);

              if (sourceNode.type === 'RouterNode') {
                console.log('sourceNode:', sourceNode);
                console.log('sourceNode.config:', edge);
                return {
                  source_id: sourceNode?.new_id || '',
                  target_id: targetNode?.new_id || '',
                  source_handle: edge.sourceHandle,
                  target_handle: edge.targetHandle,
                };
              }

              return {
                source_id: sourceNode?.new_id || '',
                target_id: targetNode?.new_id || '',
              };
            }),
            test_inputs: testInputs,
          }
        };

        console.log('send to b/e workflow:', updatedWorkflow);
        await updateWorkflow(workflowID, updatedWorkflow);
      } catch (error) {
        console.error('Error saving workflow:', error);
      }
    }, 1000)
  ).current;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  // Return a stable callback that triggers the debounced save
  return useCallback(() => {
    debouncedSave();
  }, [debouncedSave]);
};