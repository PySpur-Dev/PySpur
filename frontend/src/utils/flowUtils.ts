import { v4 as uuidv4 } from 'uuid';
import { createNode } from './nodeFactory';
import { ReactFlowInstance } from '@xyflow/react';
import { AppDispatch } from '../store/store';
import { addNode, connect, deleteEdge } from '../store/canvasSlice';

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
  [key: string]: any; // Adjust this type based on the actual structure of nodeTypes
}

interface MappedNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
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

export const mapNodesAndEdges = (
  definition: Definition,
  nodeTypes: NodeTypes
): { nodes: MappedNode[]; edges: MappedEdge[] } => {
  const { nodes, links } = definition;
  console.log('nodes', nodes);

  // Map nodes to the expected format
  const mappedNodes: MappedNode[] = nodes.map((node) =>
    createNode(
      nodeTypes,
      node.node_type,
      node.id,
      { x: node.coordinates.x, y: node.coordinates.y },
      node.additionalData || {}
    )
  );

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

interface Edge {
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
  edges: Edge[]
): Edge[] => {
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

interface Position {
  x: number;
  y: number;
}

interface NodeData {
  config?: {
    input_schema?: Record<string, string>;
    output_schema?: Record<string, string>;
  };
}

interface FlowNode {
  id: string;
  position: Position;
  data?: NodeData;
}

const generateNewNodeId = (
  nodes: FlowNode[],
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
  nodes: FlowNode[],
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

  const newNode = createNode(nodeTypes, nodeType, id, position);
  dispatch(addNode({ node: newNode }));
};

export const insertNodeBetweenNodes = (
  nodes: FlowNode[],
  nodeTypes: Record<string, any>,
  nodeType: string,
  sourceNode: FlowNode,
  targetNode: FlowNode,
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
  const newNode = createNode(nodeTypes, nodeType, id, newPosition);

  // First delete the existing edge
  dispatch(deleteEdge({ edgeId }));

  // Then add the new node
  dispatch(addNode({ node: newNode }));

  // Create source -> new node connection
  dispatch(connect({
    connection: {
      source: sourceNode.id,
      target: id,
      sourceHandle: sourceNode.id,
      targetHandle: sourceNode.id,
    }
  }));

  // Create new node -> target connection
  dispatch(connect({
    connection: {
      source: id,
      target: targetNode.id,
      sourceHandle: id,
      targetHandle: id,
    }
  }));

  onComplete?.();
};