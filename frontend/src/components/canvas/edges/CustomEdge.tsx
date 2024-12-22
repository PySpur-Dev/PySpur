import React, { useState } from 'react';
import { EdgeProps, getStraightPath, useReactFlow } from '@xyflow/react';
import { Button } from "@nextui-org/react";
import { Icon } from "@iconify/react";
import { useDispatch } from 'react-redux';
import { deleteCanvasEdge } from '../../../store/canvasSlice';

// Static styles
const staticStyles = {
  path: {
    stroke: '#b1b1b7',
    strokeWidth: 2,
    fill: 'none',
  },
  button: {
    position: 'absolute' as const,
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'all' as const,
  },
};

const CustomEdge: React.FC<EdgeProps> = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
}) => {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const [isHovered, setIsHovered] = useState(false);
  const dispatch = useDispatch();

  const handleDelete = () => {
    dispatch(deleteCanvasEdge(id));
  };

  return (
    <>
      <path
        id={id}
        style={staticStyles.path}
        d={edgePath}
        className={`${selected || isHovered ? '!stroke-primary' : ''} transition-colors`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      {(selected || isHovered) && (
        <Button
          isIconOnly
          size="sm"
          variant="light"
          radius="full"
          style={{
            ...staticStyles.button,
            left: labelX,
            top: labelY,
          }}
          onPress={handleDelete}
          className="bg-background"
        >
          <Icon icon="solar:close-circle-bold-duotone" className="text-danger" width={20} />
        </Button>
      )}
    </>
  );
};

export default CustomEdge;