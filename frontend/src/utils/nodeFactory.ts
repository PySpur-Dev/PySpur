import { CanvasNode } from '@/store/canvasSlice';
import { NodeConfigData } from '@/store/nodeDataSlice';
import cloneDeep from 'lodash/cloneDeep';

// Define types for the node structure
interface NodeType {
  name: string;
  visual_tag: {
    acronym: string;
    color: string;
  };
  config: Record<string, any>;
}

interface NodeTypes {
  [category: string]: NodeType[];
}

interface Position {
  x: number;
  y: number;
}

// Function to create a node based on its type
export const createNode = (
  nodeTypes: NodeTypes,
  type: string,
  id: string,
  position: Position,
): { canvasNode: CanvasNode | null; configData: NodeConfigData | null } => {
  let nodeType: NodeType | null = null;

  console.log('Creating node:', { type, id, nodeTypes });

  for (const category in nodeTypes) {
    const found = nodeTypes[category].find((node) => node.name === type);
    if (found) {
      nodeType = found;
      break;
    }
  }

  if (!nodeType) {
    console.error(`Could not find node type "${type}" in nodeTypes:`, nodeTypes);
    return { canvasNode: null, configData: null };
  }

  // Create minimal visual node
  const canvasNode: CanvasNode = {
    id,
    type: nodeType.name,
    position,
    data: {
      title: id,
      acronym: nodeType.visual_tag.acronym,
      color: nodeType.visual_tag.color,
    },
  };

  // Create config data
  const configData: NodeConfigData = {
    config: {
      ...cloneDeep(nodeType.config),
      title: id,
    }
  };

  console.log('Created node:', { canvasNode, configData });
  return { canvasNode, configData };
};