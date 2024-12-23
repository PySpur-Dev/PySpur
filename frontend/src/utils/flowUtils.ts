import { v4 as uuidv4 } from 'uuid';
import { createNode } from './nodeFactory';
import { ReactFlowInstance } from '@xyflow/react';
import { AppDispatch } from '../store/store';
import { addCanvasNode, connectEdge, deleteCanvasEdge, CanvasNode } from '../store/canvasSlice';

// Define types for the function parameters and return values
interface NodeDefinition {
  id: string;
  node_type: string;
  coordinates: { x: number; y: number };
  additionalData?: Record<string, any>;
}

interface LinkDefinition {
  source_id: string;
  target_id: string;
  source_output_key: string;
  target_input_key: string;
  selected?: boolean;
}

interface Definition {
  nodes: NodeDefinition[];
  links: LinkDefinition[];
}

interface NodeTypes {
  [key: string]: any;
}

export const mapNodesAndEdges = (
  definition: Definition,
  nodeTypes: NodeTypes
): { nodes: CanvasNode[]; edges: MappedEdge[] } => {
  const { nodes, links } = definition;

  // Map nodes to the expected format
  const mappedNodes: CanvasNode[] = nodes
    .map((node) => {
      const result = createNode(
        nodeTypes,
        node.node_type,
        node.id,
        { x: node.coordinates.x, y: node.coordinates.y }
      );
      return result.canvasNode;
    })
    .filter((node): node is CanvasNode => node !== null);

  // Map links to the expected edge format
  const mappedEdges: MappedEdge[] = links.map((link) => ({
    id: uuidv4(),
    key: uuidv4(),
    selected: link.selected || false,
    source: link.source_id,
    target: link.target_id,
    sourceHandle: link.source_output_key,
    targetHandle: link.target_input_key,
  }));

  return { nodes: mappedNodes, edges: mappedEdges };
};

// Define types for handleSchemaChanges
interface Node {
  config?: {
    input_schema?: Record<string, any>;
    output_schema?: Record<string, any>;
  };
}

interface Data {
  config?: {
    input_schema?: Record<string, any>;
    output_schema?: Record<string, any>;
  };
}

interface MappedEdge {
  id: string;
  key: string;
  selected: boolean;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
}

export const handleSchemaChanges = (
  node: Node,
  data: Data,
  edges: MappedEdge[]
): MappedEdge[] => {
  const oldConfig = node.config || {};
  const newConfig = data.config || {};

  const oldInputKeys = Object.keys(oldConfig.input_schema || {});
  const newInputKeys = Object.keys(newConfig.input_schema || {});

  const oldOutputKeys = Object.keys(oldConfig.output_schema || {});
  const newOutputKeys = Object.keys(newConfig.output_schema || {});

  // Handle input schema changes
  oldInputKeys.forEach((oldKey) => {
    if (!newInputKeys.includes(oldKey)) {
      edges = edges.map((edge) => {
        if (edge.sourceHandle === oldKey) {
          return { ...edge, sourceHandle: null };
        }
        if (edge.targetHandle === oldKey) {
          return { ...edge, targetHandle: null };
        }
        return edge;
      });
    }
  });

  // Handle output schema changes
  oldOutputKeys.forEach((oldKey) => {
    if (!newOutputKeys.includes(oldKey)) {
      edges = edges.map((edge) => {
        if (edge.sourceHandle === oldKey) {
          return { ...edge, sourceHandle: null };
        }
        if (edge.targetHandle === oldKey) {
          return { ...edge, targetHandle: null };
        }
        return edge;
      });
    }
  });

  return edges;
};

const generateNewNodeId = (
  nodes: CanvasNode[],
  nodeType: string
): string => {
  const existingIds = nodes.map((node) => node.id);
  const sanitizedType = nodeType.replace(/\s+/g, '_');
  let counter = 1;
  let newId = `${sanitizedType}_${counter}`;

  while (existingIds.includes(newId)) {
    counter++;
    newId = `${sanitizedType}_${counter}`;
  }

  return newId;
};

export const createNodeAtCenter = (
  nodes: CanvasNode[],
  nodeTypes: Record<string, any>,
  nodeType: string,
  reactFlowInstance: ReactFlowInstance,
  dispatch: AppDispatch
): void => {
  const id = generateNewNodeId(nodes, nodeType);
  const center = reactFlowInstance.screenToFlowPosition({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });

  const position = {
    x: center.x,
    y: center.y,
  };

  const result = createNode(nodeTypes, nodeType, id, position);
  if (result.canvasNode) {
    dispatch(addCanvasNode(result.canvasNode));
  }
};

export const insertNodeBetweenNodes = (
  nodes: CanvasNode[],
  nodeTypes: Record<string, any>,
  nodeType: string,
  sourceNode: CanvasNode,
  targetNode: CanvasNode,
  edgeId: string,
  reactFlowInstance: ReactFlowInstance,
  dispatch: AppDispatch,
  onComplete?: () => void
): void => {
  if (!sourceNode?.position || !targetNode?.position) {
    console.error('Invalid source or target node position');
    return;
  }

  const id = generateNewNodeId(nodes, nodeType);
  const newPosition = {
    x: (sourceNode.position.x + targetNode.position.x) / 2,
    y: (sourceNode.position.y + targetNode.position.y) / 2,
  };

  // Create the new node
  const result = createNode(nodeTypes, nodeType, id, newPosition);
  if (!result.canvasNode) {
    console.error('Failed to create new node');
    return;
  }

  // First delete the existing edge
  dispatch(deleteCanvasEdge(edgeId));

  // Then add the new node
  dispatch(addCanvasNode(result.canvasNode));

  // Create source -> new node connection
  dispatch(connectEdge({
    source: sourceNode.id,
    target: id,
    sourceHandle: sourceNode.data.title,
    targetHandle: result.canvasNode.data.title,
  }));

  // Create new node -> target connection
  dispatch(connectEdge({
    source: id,
    target: targetNode.id,
    sourceHandle: result.canvasNode.data.title,
    targetHandle: targetNode.data.title,
  }));

  if (onComplete) {
    onComplete();
  }
};