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
import { deleteCanvasEdge } from '../../../store/canvasSlice';

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
    backgroundColor: 'white',
    padding: '4px',
    borderRadius: '9999px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  }
} as const;

// Add this near the other static styles
const defaultEdgeStyle = {
  strokeWidth: 2,
  stroke: '#555',
} as const;

type CustomEdgeData = {
  onPopoverOpen?: (params: {
    sourceNode: Node;
    targetNode: Node;
    edgeId: string;
  }) => void;
  showPlusButton?: boolean;
};

type CustomEdgeProps = EdgeProps & {
  data?: CustomEdgeData;
};

const CustomEdge = ({
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
}: CustomEdgeProps) => {
  const { onPopoverOpen, showPlusButton } = data || {};
  const reactFlowInstance = useReactFlow();
  const dispatch = useDispatch();

  // Get the full node objects
  const sourceNode = reactFlowInstance.getNode(source);
  const targetNode = reactFlowInstance.getNode(target);

  // Memoize the path calculation
  const [edgePath, labelX, labelY] = useMemo(() => {
    // Source should be on the right (output) side
    const calculatedSourcePosition = Position.Right;
    // Target should be on the left (input) side
    const calculatedTargetPosition = Position.Left;

    return getBezierPath({
      sourceX,
      sourceY,
      sourcePosition: calculatedSourcePosition,
      targetX,
      targetY,
      targetPosition: calculatedTargetPosition,
    });
  }, [sourceX, sourceY, targetX, targetY]);

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
    onPopoverOpen?.({
      sourceNode,
      targetNode,
      edgeId: id
    });
  }, [sourceNode, targetNode, id, onPopoverOpen]);

  const handleDeleteEdge = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    dispatch(deleteCanvasEdge(id));
  }, [id, dispatch]);

  // Memoize the combined edge style
  const combinedStyle = useMemo(() => ({
    ...defaultEdgeStyle,
    ...(style as React.CSSProperties)
  }), [style]);

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
                size="sm"
                variant="light"
                radius="full"
                onClick={handleAddNode}
                className="bg-background hover:bg-default-100"
              >
                <Icon icon="solar:add-circle-bold-duotone" className="text-primary" width={20} />
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                radius="full"
                onClick={handleDeleteEdge}
                className="bg-background hover:bg-default-100"
              >
                <Icon icon="solar:trash-bin-trash-bold-duotone" className="text-danger" width={20} />
              </Button>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default React.memo(CustomEdge);