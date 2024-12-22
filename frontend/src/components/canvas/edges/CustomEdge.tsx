import React, { useCallback, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  Edge,
  Node,
  Position,
  EdgeProps
} from '@xyflow/react';
import { Button } from '@nextui-org/react';
import { Icon } from "@iconify/react";
import { useDispatch } from 'react-redux';
import { deleteEdge } from '../../../store/canvasSlice';

// Static styles
const staticStyles = {
  labelContainer: {
    position: 'absolute' as const,
    pointerEvents: 'all' as const,
  },
  buttonContainer: {
    display: 'flex',
    gap: '5px',
    justifyContent: 'center',
    alignItems: 'center',
  }
} as const;

// Add this near the other static styles
const defaultEdgeStyle = {
  strokeWidth: 2,
  stroke: '#555',
} as const;

interface CustomEdgeData {
  onPopoverOpen: (params: {
    sourceNode: {
      id: string;
      position: { x: number; y: number };
      data: any;
    };
    targetNode: {
      id: string;
      position: { x: number; y: number };
      data: any;
    };
    edgeId: string;
  }) => void;
  showPlusButton: boolean;
}

type CustomEdgeProps = EdgeProps<CustomEdgeData>;

const CustomEdge: React.FC<CustomEdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
  source,
  target,
}) => {
  const { onPopoverOpen, showPlusButton } = data;
  const reactFlowInstance = useReactFlow();
  const dispatch = useDispatch();

  // Get the full node objects
  const sourceNode = reactFlowInstance.getNode(source);
  const targetNode = reactFlowInstance.getNode(target);

  // Memoize the path calculation
  const [edgePath, labelX, labelY] = useMemo(() => getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  }), [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition]);

  // Memoize the label style
  const labelStyle = useMemo(() => ({
    ...staticStyles.labelContainer,
    transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
  }), [labelX, labelY]);

  // Memoize handlers
  const handleAddNode = useCallback(() => {
    if (!sourceNode || !targetNode) {
      console.error('Source or target node not found');
      return;
    }
    onPopoverOpen({
      sourceNode: {
        id: sourceNode.id,
        position: sourceNode.position,
        data: sourceNode.data
      },
      targetNode: {
        id: targetNode.id,
        position: targetNode.position,
        data: targetNode.data
      },
      edgeId: id
    });
  }, [sourceNode, targetNode, id, onPopoverOpen]);

  const handleDeleteEdge = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    dispatch(deleteEdge({ edgeId: id }));
  }, [id, dispatch]);

  // Memoize the combined edge style
  const combinedStyle = useMemo(() => ({
    ...defaultEdgeStyle,
    ...style
  }), [JSON.stringify(style)]);

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={combinedStyle} />

      {showPlusButton && (
        <EdgeLabelRenderer>
          <div
            style={labelStyle}
            className="nodrag nopan"
          >
            <div style={staticStyles.buttonContainer}>
              <Button
                isIconOnly
                onClick={handleAddNode}
              >
                <Icon icon="solar:add-circle-linear" width={20} className="text-default-500" />
              </Button>
              <Button
                isIconOnly
                onClick={handleDeleteEdge}
              >
                <Icon icon="solar:trash-bin-trash-linear" width={20} />
              </Button>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default React.memo(CustomEdge);