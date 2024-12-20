import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  setNodes,
  FlowWorkflowNode,
  FlowWorkflowEdge,
  FlowState,
} from '../../store/flowSlice';
import NodeSidebar from '../nodes/nodeSidebar/NodeSidebar';
import { Dropdown, DropdownMenu, DropdownSection, DropdownItem } from '@nextui-org/react';
import DynamicNode from '../nodes/DynamicNode';
import { v4 as uuidv4 } from 'uuid';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import CustomEdge from './edges/CustomEdge';
import { getHelperLines } from '../../utils/helperLines';
import HelperLinesRenderer from '../HelperLines';
import useCopyPaste from '../../utils/useCopyPaste';
import { useModeStore } from '../../store/modeStore';
import { initializeFlow } from '../../store/flowSlice';
import InputNode from '../nodes/InputNode';
import { RouterNode } from '../nodes/logic/RouterNode';
import MergeNode from '../nodes/logic/MergeNode';
import { useSaveWorkflow } from '../../hooks/useSaveWorkflow';
import LoadingSpinner from '../LoadingSpinner';
import dagre from '@dagrejs/dagre';
import CollapsibleNodePanel from '../nodes/CollapsibleNodePanel';
import { setNodePanelExpanded } from '../../store/panelSlice';
import { insertNodeBetweenNodes } from '../../utils/flowUtils';
import { getLayoutedNodes } from '@/utils/nodeLayoutUtils';
import { WorkflowCreateRequest } from '@/types/api_types/workflowSchemas';

// Type definitions
interface NodeTypesConfig {
  [category: string]: Array<{
    name: string;
    [key: string]: any;
  }>;
}

interface FlowCanvasProps {
  workflowData?: WorkflowCreateRequest;
  workflowID?: string;
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
  panel: {
    isNodePanelExpanded: boolean;
  };
}

const useNodeTypes = ({ nodeTypesConfig }: { nodeTypesConfig: NodeTypesConfig | undefined }) => {
  const nodeTypes = useMemo<NodeTypes>(() => {
    if (!nodeTypesConfig) return {};
    return Object.keys(nodeTypesConfig).reduce<NodeTypes>((acc, category) => {
      nodeTypesConfig[category].forEach(node => {
        if (node.name === 'InputNode') {
          acc[node.name] = InputNode;
        } else if (node.name === 'RouterNode') {
          acc[node.name] = RouterNode;
        } else if (node.name === 'MergeNode') {
          acc[node.name] = MergeNode;
        } else {
          acc[node.name] = (props: any) => {
            return <DynamicNode {...props} type={node.name} displayOutput={true} />;
          };
        }
      });
      return acc;
    }, {});
  }, [nodeTypesConfig]);

  const isLoading = !nodeTypesConfig;
  return { nodeTypes, isLoading };
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

// Create a wrapper component that includes ReactFlow logic
const FlowCanvasContent: React.FC<FlowCanvasProps> = (props) => {
  const { workflowData, workflowID } = props;
  const dispatch = useDispatch();

  const nodeTypesConfig = useSelector((state: RootState) => state.nodeTypes.data);

  useEffect(() => {
    if (workflowData) {
      console.log('workflowData', workflowData);
      dispatch(initializeFlow({
        nodeTypes: nodeTypesConfig,
        definition: workflowData.definition,
        workflowID: workflowID,
        name: workflowData.name
      }));
    }
  }, [dispatch, workflowData, workflowID, nodeTypesConfig]);

  const { nodeTypes, isLoading } = useNodeTypes({ nodeTypesConfig });

  const nodes = useSelector((state: RootState) => state.flow.nodes);
  const edges = useSelector((state: RootState) => state.flow.edges);
  const selectedNodeID = useSelector((state: RootState) => state.flow.selectedNode);

  const saveWorkflow = useSaveWorkflow();

  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      saveWorkflow();
    }
  }, [nodes, edges, saveWorkflow]);

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
          const snapPosition = { x: positionChange.position.x, y: positionChange.position.y };
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
      console.log('onConnect', connection);
      if (!connection.targetHandle || connection.targetHandle === 'node-body') {
        const sourceNode = nodes.find((n) => n.id === connection.source);
        const targetNode = nodes.find((n) => n.id === connection.target);

        if (sourceNode && targetNode) {
          const outputHandleName = connection.sourceHandle;

          if (!outputHandleName) {
            console.error('Source handle is not specified.');
            return;
          }

          connection = {
            ...connection,
            targetHandle: outputHandleName,
          };
        }
      }
      console.log('connection', connection);
      const sourceNode = nodes.find((n) => n.id === connection.source);

      if (sourceNode.type === 'RouterNode') {
        connection = {
          ...connection,
          targetHandle: connection.source + '_' + connection.sourceHandle,
        };
      }
      else {
        connection = {
          ...connection,
          targetHandle: connection.sourceHandle,
        };
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
        stroke: hoveredEdge === edge.id || 
                hoveredNode === edge.source || 
                hoveredNode === edge.target 
          ? '#555' 
          : '#999',
        strokeWidth: hoveredEdge === edge.id || 
                    hoveredNode === edge.source || 
                    hoveredNode === edge.target 
          ? 3 
          : 1.5,
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
    [setHoveredEdge]
  );

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdge(null);
  }, [setHoveredEdge]);

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
    dispatch(setNodePanelExpanded(false));
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


  const handleLayout = useCallback(() => {
    const layoutedNodes = getLayoutedNodes(nodes as FlowWorkflowNode[], edges as FlowWorkflowEdge[]);
    dispatch(setNodes({ nodes: layoutedNodes }));
  }, [nodes, edges, dispatch]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  useKeyboardShortcuts(selectedNodeID, nodes, nodeTypes, dispatch);

  const { cut, copy, paste, bufferedNodes } = useCopyPaste();
  useCopyPaste();

  const proOptions = {
    hideAttribution: true
  };

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
  }, [setHoveredNode]);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, [setHoveredNode]);

  const handleAddNodeBetween = (nodeName: string, sourceNode: any, targetNode: any, edgeId: string) => {
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

  if (isLoading) {
    return <LoadingSpinner />;
  }

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
            <DropdownMenu>
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
                      {node.config.title}
                    </DropdownItem>
                  ))}
                </DropdownSection>
              ))}
            </DropdownMenu>
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
            selectionKeyCode={mode === 'pointer' ? null : 'Shift'}
            multiSelectionKeyCode={mode === 'pointer' ? null : 'Shift'} 
            deleteKeyCode="Delete"
            nodesConnectable={true}
            connectionMode={ConnectionMode.Loose}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onEdgeMouseEnter={onEdgeMouseEnter}
            onEdgeMouseLeave={onEdgeMouseLeave}
            snapToGrid={true}
            snapGrid={[25, 25]}
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
        <div className="border-gray-200 absolute top-4 left-4" style={{ zIndex: 2 }}>
          <CollapsibleNodePanel />
        </div>
      </div>
    </div>
  );
};

// Main component that provides the ReactFlow context
const FlowCanvas: React.FC<FlowCanvasProps> = ({ workflowData, workflowID }) => {
  return (
    <ReactFlowProvider>
      <FlowCanvasContent workflowData={workflowData} workflowID={workflowID} />
    </ReactFlowProvider>
  );
};

export default FlowCanvas;