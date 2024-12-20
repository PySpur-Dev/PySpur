import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  ReactFlowProvider,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  NodeTypes,
  EdgeTypes,
  ReactFlowInstance,
  XYPosition,
  SelectionMode,
  ConnectionMode,
  useViewport,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import { useSelector, useDispatch } from 'react-redux';
import Operator from './footer/Operator';
import {
  nodesChange,
  edgesChange,
  connect,
  setSelectedNode,
  deleteNode,
  setWorkflowInputVariable,
  updateNodeData,
  setNodes,
  FlowState,
  FlowWorkflowNode,
  FlowWorkflowEdge,
} from '../../store/flowSlice';
import NodeSidebar from '../nodes/nodeSidebar/NodeSidebar';
import { Dropdown, DropdownMenu, DropdownSection, DropdownItem } from '@nextui-org/react';
import { v4 as uuidv4 } from 'uuid';
import CustomEdge from './edges/CustomEdge';
import { getHelperLines } from '../../utils/helperLines';
import HelperLinesRenderer from '../HelperLines';
import useCopyPaste from '../../utils/useCopyPaste';
import { Mode, useModeStore } from '../../store/modeStore';
import { initializeFlow, setNodeOutputs } from '../../store/flowSlice';
import InputNode from '../nodes/InputNode';
import dagre from '@dagrejs/dagre';
import LoadingSpinner from '../LoadingSpinner';
import { RouterNode } from '../nodes/logic/RouterNode';
import DynamicNode from '../nodes/DynamicNode';
import { WorkflowDefinition } from '@/types/api_types/workflowSchemas';
import { getLayoutedNodes } from '@/utils/nodeLayoutUtils';
import { insertNodeBetweenNodes } from '@/utils/flowUtils';

interface NodeTypesConfig {
  [category: string]: Array<{
    name: string;
    config?: {
      title?: string;
    };
    [key: string]: any;
  }>;
}

interface RunViewFlowCanvasProps {
  workflowData?: {
    definition: WorkflowDefinition;
    name: string;
  };
  workflowID?: string;
  nodeOutputs?: Record<string, any>;
}

interface HelperLines {
  horizontal: number | null;
  vertical: number | null;
}

interface RootState {
  nodeTypes: {
    data: NodeTypesConfig;
  };
  flow: FlowState;
}

const useNodeTypes = ({ nodeTypesConfig }: { nodeTypesConfig: NodeTypesConfig | undefined }) => {
  const nodeTypes = useMemo<NodeTypes>(() => {
    if (!nodeTypesConfig) return {};
    const types = Object.keys(nodeTypesConfig).reduce<NodeTypes>((acc, category) => {
      nodeTypesConfig[category].forEach(node => {
        if (node.name === 'InputNode') {
          acc[node.name] = InputNode;
        } else if (node.name === 'RouterNode') {
          acc[node.name] = RouterNode;
        } else {
          acc[node.name] = (props) => {
            return <DynamicNode {...props} type={node.name} displayOutput={true}/>;
          };
        }
      });
      return acc;
    }, {});

    return types;
  }, [nodeTypesConfig]);

  const isLoading = !nodeTypesConfig;
  return { nodeTypes, isLoading };
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};



const RunViewFlowCanvasContent: React.FC<RunViewFlowCanvasProps> = ({ workflowData, workflowID, nodeOutputs }) => {
  const dispatch = useDispatch();

  const nodeTypesConfig = useSelector((state: RootState) => state.nodeTypes.data);

  useEffect(() => {
    if (workflowData) {
      console.log('workflowData', workflowData);
      if (workflowData.definition.nodes) {
        const inputNode = workflowData.definition.nodes.filter(node => node.node_type === 'InputNode');
        if (inputNode.length > 0) {
          const inputSchema = inputNode[0].config.input_schema;
          if (inputSchema) {
            const workflowInputVariables = Object.entries(inputSchema).map(([key, type]) => {
              return { key, value: '' };
            });
            workflowInputVariables.forEach(variable => {
              dispatch(setWorkflowInputVariable(variable));
            });
          }
        }
      }
      dispatch(initializeFlow({ nodeTypes: nodeTypesConfig, ...workflowData, workflowID }));
      console.log('Node Outputs:', nodeOutputs);
      dispatch(setNodeOutputs(nodeOutputs));
    }
  }, [dispatch, workflowData, workflowID]);

  const { nodeTypes, isLoading } = useNodeTypes({ nodeTypesConfig });

  const nodes = useSelector((state: RootState) => state.flow.nodes);
  const edges = useSelector((state: RootState) => state.flow.edges);
  const selectedNodeID = useSelector((state: RootState) => state.flow.selectedNode);

  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [helperLines, setHelperLines] = useState<HelperLines>({ horizontal: null, vertical: null });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [isPopoverContentVisible, setPopoverContentVisible] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<{ sourceNode: Node; targetNode: Node; edgeId: string } | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const showHelperLines = false;

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!changes.some((c) => c.type === 'position')) {
        setHelperLines({ horizontal: null, vertical: null });
        dispatch(nodesChange({ changes }));
        return;
      }

      const positionChange = changes.find(
        (c): c is NodeChange & { type: 'position'; position: XYPosition } =>
          c.type === 'position' && c.position !== undefined
      );

      if (positionChange && showHelperLines) {
        const { horizontal, vertical } = getHelperLines(positionChange, nodes);
        setHelperLines({ horizontal, vertical });

        if (horizontal || vertical) {
          const snapPosition = { 
            x: positionChange.position.x, 
            y: positionChange.position.y 
          };
          if (horizontal) snapPosition.y = horizontal;
          if (vertical) snapPosition.x = vertical;
          positionChange.position = snapPosition;
        }
      }

      dispatch(nodesChange({ changes }));
    },
    [dispatch, nodes, showHelperLines]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => dispatch(edgesChange({ changes })),
    [dispatch]
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.targetHandle || connection.targetHandle === 'node-body') {
        const sourceNode = nodes.find((n) => n.id === connection.source);
        const targetNode = nodes.find((n) => n.id === connection.target);

        if (sourceNode && targetNode) {
          const outputHandleName = connection.sourceHandle;

          if (!outputHandleName) {
            console.error('Source handle is not specified.');
            return;
          }

          const updatedInputSchema = {
            ...targetNode.data.config.input_schema,
            [outputHandleName]: 'str',
          };

          dispatch(
            updateNodeData({
              id: targetNode.id,
              data: {
                config: {
                  ...targetNode.data.config,
                  input_schema: updatedInputSchema,
                },
              },
            })
          );

          connection = {
            ...connection,
            targetHandle: outputHandleName,
          };
        }
      }

      const newEdge: Edge = {
        ...connection,
        id: uuidv4(),
        key: uuidv4(),
      };
      dispatch(connect({ connection: newEdge }));
    },
    [dispatch, nodes]
  );

  const handlePopoverOpen = useCallback(({ sourceNode, targetNode, edgeId }: { sourceNode: Node; targetNode: Node; edgeId: string }) => {
    if (!reactFlowInstance) return;

    const centerX = (sourceNode.position.x + targetNode.position.x) / 2;
    const centerY = (sourceNode.position.y + targetNode.position.y) / 2;

    const screenPos = reactFlowInstance.flowToScreenPosition({
      x: centerX,
      y: centerY,
    });

    setPopoverPosition({
      x: screenPos.x,
      y: screenPos.y
    });
    setSelectedEdge({ sourceNode, targetNode, edgeId });
    setPopoverContentVisible(true);
  }, [reactFlowInstance]);

  const styledEdges = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      type: 'custom',
      style: {
        stroke: edge.id === hoveredEdge
          ? 'black'
          : edge.source === hoveredNode || edge.target === hoveredNode
            ? 'black'
            : '#555',
        strokeWidth: edge.id === hoveredEdge
          ? 4
          : edge.source === hoveredNode || edge.target === hoveredNode
            ? 4
            : 2,
      },
      data: {
        ...edge.data,
        showPlusButton: edge.id === hoveredEdge,
        onPopoverOpen: handlePopoverOpen,
      },
      key: edge.id,
    }));
  }, [edges, hoveredNode, hoveredEdge, handlePopoverOpen]);

  const onEdgeMouseEnter = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setHoveredEdge(edge.id);
    },
    []
  );

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdge(null);
  }, []);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
    instance.setViewport({ x: 0, y: 0, zoom: 0.8 });
  }, []);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      dispatch(setSelectedNode({ nodeId: node.id }));
    },
    [dispatch]
  );

  const onPaneClick = useCallback(() => {
    if (selectedNodeID) {
      dispatch(setSelectedNode({ nodeId: null }));
    }
  }, [dispatch, selectedNodeID]);

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      deletedNodes.forEach((node) => {
        dispatch(deleteNode({ nodeId: node.id }));
        if (selectedNodeID === node.id) {
          dispatch(setSelectedNode({ nodeId: null }));
        }
      });
    },
    [dispatch, selectedNodeID]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isFlowCanvasFocused = (event.target as HTMLElement).closest('.react-flow');
      if (!isFlowCanvasFocused) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedNodes = nodes.filter(node => node.selected);
        if (selectedNodes.length > 0) {
          onNodesDelete(selectedNodes);
        }
      }
    },
    [nodes, onNodesDelete]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const mode = useModeStore((state) => state.mode);

  const nodesWithMode = useMemo(() => {
    return nodes
      .filter(Boolean)
      .map(node => ({
        ...node,
        draggable: true,
        selectable: mode === 'pointer',
        position: node?.position,
        type: node?.type,
        data: node?.data,
      }));
  }, [nodes, mode]);

  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    setHoveredNode(node.id);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const handleLayout = useCallback(() => {
    const layoutedNodes = getLayoutedNodes(nodes as FlowWorkflowNode[], edges as FlowWorkflowEdge[]);
    dispatch(setNodes({ nodes: layoutedNodes }));
  }, [nodes, edges, dispatch]);

  const handleAddNodeBetween = (nodeName: string, sourceNode: Node, targetNode: Node, edgeId: string) => {
    insertNodeBetweenNodes(
      nodes,
      nodeTypesConfig,
      nodeName,
      sourceNode,
      targetNode,
      edgeId,
      reactFlowInstance,
      dispatch,
      () => setPopoverContentVisible(false)
    );
  };

  useCopyPaste();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const proOptions = {
    hideAttribution: true
  };

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {isPopoverContentVisible && selectedEdge && (
        <div
          style={{
            position: 'absolute',
            left: `${popoverPosition.x}px`,
            top: `${popoverPosition.y}px`,
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
          }}
        >
          <Dropdown
            isOpen={isPopoverContentVisible}
            onOpenChange={setPopoverContentVisible}
            placement="bottom"
          >
            <DropdownMenu aria-label="Node types">
              {nodeTypesConfig && Object.keys(nodeTypesConfig).filter(category => category !== "Input/Output").map((category) => (
                <DropdownSection key={category} title={category} showDivider>
                  {nodeTypesConfig[category].map((node) => (
                    <DropdownItem
                      key={node.name}
                      onClick={() =>
                        handleAddNodeBetween(
                          node.name,
                          selectedEdge.sourceNode,
                          selectedEdge.targetNode,
                          selectedEdge.edgeId
                        )
                      }
                    >
                      {node.name}
                    </DropdownItem>
                  ))}
                </DropdownSection>
              ))}
            </DropdownMenu>
            <></>
          </Dropdown>
        </div>
      )}

      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            overflow: 'auto',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <ReactFlow
            nodes={nodesWithMode}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            onInit={onInit}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodesDelete={onNodesDelete}
            proOptions={proOptions}
            panOnDrag={mode === 'hand' && !nodes.filter(Boolean).some(n => n.selected)}
            panOnScroll={true}
            zoomOnScroll={true}
            minZoom={0.1}
            maxZoom={2}
            selectionMode={mode === 'pointer' ? SelectionMode.Full : SelectionMode.Partial}
            selectNodesOnDrag={mode === 'pointer'}
            selectionOnDrag={mode === 'pointer'}
            selectionKeyCode={mode === 'pointer' ? null : undefined}
            multiSelectionKeyCode={mode === 'pointer' ? null : undefined}
            deleteKeyCode="Delete"
            nodesConnectable={true}
            connectionMode={ConnectionMode.Loose}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onEdgeMouseEnter={onEdgeMouseEnter}
            onEdgeMouseLeave={onEdgeMouseLeave}
          >
            <Background />
            {showHelperLines && (
              <HelperLinesRenderer
                horizontal={helperLines.horizontal}
                vertical={helperLines.vertical}
              />
            )}
            <Operator handleLayout={handleLayout} />
          </ReactFlow>
        </div>
        {selectedNodeID && (
          <div
            className="absolute top-0 right-0 h-full bg-white border-l border-gray-200"
            style={{ zIndex: 2 }}
          >
            <NodeSidebar nodeID={selectedNodeID} />
          </div>
        )}
      </div>
    </div>
  );
};

const RunViewFlowCanvas: React.FC<RunViewFlowCanvasProps> = ({ workflowData, workflowID, nodeOutputs }) => {
  return (
    <ReactFlowProvider>
      <RunViewFlowCanvasContent 
        workflowData={workflowData} 
        workflowID={workflowID} 
        nodeOutputs={nodeOutputs} 
      />
    </ReactFlowProvider>
    );
}

export default RunViewFlowCanvas;