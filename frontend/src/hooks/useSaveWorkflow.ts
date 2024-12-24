import { useCallback, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { updateWorkflow } from '../utils/api';
import { RootState } from '../store/store';
import { debounce } from 'lodash';
import { WorkflowCreateRequest, WorkflowNode, TestInput as WorkflowTestInput } from '@/types/api_types/workflowSchemas';
import { TestInput as StoreTestInput } from '@/store/nodeDataSlice';

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
}

export const useSaveWorkflow = () => {
  const nodes = useSelector((state: RootState) => state.canvas.nodes);
  const edges = useSelector((state: RootState) => state.canvas.edges);
  const workflowID = useSelector((state: RootState) => state.canvas.workflowId);
  const nodeDataById = useSelector((state: RootState) => state.nodeData.nodeDataById);
  const workflowName = useSelector((state: RootState) => state.canvas.projectName);
  const testInputs = useSelector((state: RootState) => state.nodeData.testInputs);

  // Create a ref to store the current values
  const valuesRef = useRef({ nodes, edges, workflowID, nodeDataById, workflowName, testInputs });

  // Update the ref when values change
  useEffect(() => {
    valuesRef.current = { nodes, edges, workflowID, nodeDataById, workflowName, testInputs };
  }, [nodes, edges, workflowID, nodeDataById, workflowName, testInputs]);

  // Create the debounced save function once
  const debouncedSave = useRef(
    debounce(async () => {
      const { nodes, edges, workflowID, nodeDataById, workflowName, testInputs } = valuesRef.current;

      try {
        const updatedNodes = nodes
          .filter((node): node is NonNullable<typeof node> => node !== null && node !== undefined)
          .map((node) => {
            // Get the full node data from nodeDataById
            const nodeConfig = nodeDataById[node.id]?.config || {};
            const nodeTitle = nodeConfig.title || node.data.title;

            // Combine canvas node data with nodeData store data
            const combinedNode = {
              ...node,
              config: {
                ...nodeConfig,
                // Preserve any run data and task status
                run: nodeDataById[node.id]?.run,
                taskStatus: nodeDataById[node.id]?.taskStatus,
                // Ensure schemas are included
                input_schema: nodeConfig.input_schema || {},
                output_schema: nodeConfig.output_schema || {},
                // Preserve any LLM specific data
                llm_info: nodeConfig.llm_info,
                system_message: nodeConfig.system_message,
                user_message: nodeConfig.user_message,
                few_shot_examples: nodeConfig.few_shot_examples,
              },
              title: nodeTitle,
              new_id: nodeTitle || node.type || 'Untitled',
            };

            return combinedNode;
          });

        // Convert test inputs to the correct format
        const convertedTestInputs: WorkflowTestInput[] = testInputs.map((input: StoreTestInput) => ({
          ...input,
          id: parseInt(input.id, 10)
        }));

        const updatedWorkflow: WorkflowCreateRequest = {
          name: workflowName,
          description: '',
          definition: {
            nodes: updatedNodes.map(node => ({
              id: node.new_id,
              node_type: node.type,
              config: node.config,
              coordinates: node.position,
              title: node.title || node.new_id,
            } as WorkflowNode)),
            links: edges.map((edge: Edge) => {
              const sourceNode = updatedNodes.find(node => node?.id === edge.source);
              const targetNode = updatedNodes.find(node => node?.id === edge.target);

              return {
                source_id: sourceNode?.new_id || '',
                target_id: targetNode?.new_id || '',
              };
            }),
            test_inputs: convertedTestInputs,
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