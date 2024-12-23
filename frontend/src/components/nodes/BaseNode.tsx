import React, { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Handle, Position } from '@xyflow/react';
import {
  Card,
  CardHeader,
  CardBody,
  Divider,
  Button,
  Input,
  Alert,
} from "@nextui-org/react";
import { Icon } from "@iconify/react";
import { deleteCanvasNode, setSelectedNodeId, updateNodeTitle, CanvasNode } from '../../store/canvasSlice';
import { deleteNodeData, NodeConfigData } from '../../store/nodeDataSlice';
import usePartialRun from '../../hooks/usePartialRun';
import { TaskStatus } from '@/types/api_types/taskSchemas';
import isEqual from 'lodash/isEqual';
import { RootState } from '@/store/store';

interface NodeData {
  title: string;
  acronym: string;
  color: string;
}

interface BaseNodeProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  id: string;
  data: NodeData;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  isInputNode?: boolean;
  className?: string;
  handleOpenModal?: (isModalOpen: boolean) => void;
}

const getNodeTitle = (data: NodeData): string => {
  return data.title || 'Untitled';
};

const nodeComparator = (prevNode: CanvasNode, nextNode: CanvasNode) => {
  if (!prevNode || !nextNode) return false;
  // Skip position and measured properties when comparing nodes
  const { position: prevPosition, measured: prevMeasured, ...prevRest } = prevNode;
  const { position: nextPosition, measured: nextMeasured, ...nextRest } = nextNode;
  return isEqual(prevRest, nextRest);
};

interface PartialRunParams {
  workflowId: string;
  nodeId: string;
  initialInputs: Record<string, any>;
  partialOutputs: Record<string, any>;
  rerunPredecessors: boolean;
}

const staticStyles = {
  container: {
    position: 'relative' as const
  },
  targetHandle: {
    top: '50%',
    left: 0,
    width: '30%',
    height: '100%',
    zIndex: 10,
    opacity: 0,
    pointerEvents: 'auto' as const
  },
  dragHandle: {
    width: '100%',
    height: '100%',
    pointerEvents: 'none' as const
  },
  controlsCard: {
    position: 'absolute' as const,
    top: '-50px',
    right: '0px',
    padding: '4px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    pointerEvents: 'auto' as const
  },
  baseTag: {
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.75rem',
    display: 'inline-block',
    color: '#fff'
  },
  collapseButton: {
    minWidth: 'auto',
    height: '24px',
    padding: '0 8px',
    fontSize: '0.8rem',
    marginRight: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  controlsContainer: {
    position: 'absolute' as const,
    top: '8px',
    right: '8px',
    display: 'flex',
    alignItems: 'center'
  }
} as const;

const convertToPythonVariableName = (str: string): string => {
  // Replace spaces and hyphens with underscores
  str = str.replace(/[\s-]/g, '_');
  // Remove any non-alphanumeric characters except underscores
  str = str.replace(/[^a-zA-Z0-9_]/g, '');
  // Ensure the first character is a letter or underscore
  if (!/^[a-zA-Z_]/.test(str)) {
    str = '_' + str;
  }
  return str;
};

const BaseNode: React.FC<BaseNodeProps> = ({
  isCollapsed,
  setIsCollapsed,
  handleOpenModal,
  id,
  data,
  children,
  style = {},
  isInputNode = false,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showTitleError, setShowTitleError] = useState(false);
  const [titleInputValue, setTitleInputValue] = useState('');
  const dispatch = useDispatch();

  // Retrieve the node's position and edges from the Redux store
  const node = useSelector((state: RootState) => state.canvas.nodes.find((n) => n.id === id), nodeComparator);
  const edges = useSelector((state: RootState) => state.canvas.edges);
  const selectedNodeId = useSelector((state: RootState) => state.canvas.selectedNodeId);
  const nodeData = useSelector((state: RootState) => state.nodeData.nodeDataById[id]);

  const initialInputs = useSelector((state: RootState) => {
    const inputNode = state.canvas.nodes.find((node) => node.type === 'InputNode');
    if (!inputNode) return {};
    const nodeConfig = state.nodeData.nodeDataById[inputNode.id];
    return nodeConfig?.config || {};
  }, isEqual);

  const availableOutputs = useSelector((state: RootState) => {
    const outputs: Record<string, any> = {};
    Object.entries(state.nodeData.nodeDataById).forEach(([nodeId, nodeData]) => {
      if (nodeData.run) {
        outputs[nodeId] = nodeData.run;
      }
    });
    return outputs;
  }, isEqual);

  const { executePartialRun, loading } = usePartialRun();

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    setShowControls(true);
  }, [setIsHovered, setShowControls]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (!isTooltipHovered) {
      setTimeout(() => {
        setShowControls(false);
      }, 200);
    }
  }, [setIsHovered, setShowControls, isTooltipHovered]);

  const handleControlsMouseEnter = useCallback(() => {
    setShowControls(true);
    setIsTooltipHovered(true);
  }, [setShowControls, setIsTooltipHovered]);

  const handleControlsMouseLeave = useCallback(() => {
    setIsTooltipHovered(false);
    setTimeout(() => {
      if (!isHovered) {
        setShowControls(false);
      }
    }, 300);
  }, [isHovered, setShowControls, setIsTooltipHovered]);

  const handleDelete = () => {
    dispatch(deleteCanvasNode(id));
    dispatch(deleteNodeData(id));
    if (selectedNodeId === id) {
      dispatch(setSelectedNodeId(null));
    }
  };

  const handlePartialRun = () => {
    if (!node) {
      return;
    }
    setIsRunning(true);
    const rerunPredecessors = false;

    const workflowId = window.location.pathname.split('/').pop();
    if (!workflowId) return;

    executePartialRun({
      workflowId,
      nodeId: id,
      initialInputs,
      partialOutputs: availableOutputs,
      rerunPredecessors
    }).finally(() => {
      setIsRunning(false);
    });
  };

  const handleTitleChange = (newTitle: string) => {
    const validTitle = convertToPythonVariableName(newTitle);
    if (validTitle && validTitle !== getNodeTitle(data)) {
      dispatch(updateNodeTitle({ nodeId: id, newTitle: validTitle }));
    }
  };

  const isSelected = String(id) === String(selectedNodeId);

  const nodeRunStatus = nodeData?.taskStatus as TaskStatus | undefined;

  let borderColor = 'gray';

  switch (nodeRunStatus) {
    case 'PENDING':
      borderColor = 'yellow';
      break;
    case 'RUNNING':
      borderColor = 'blue';
      break;
    case 'COMPLETED':
      borderColor = '#4CAF50';
      break;
    case 'FAILED':
      borderColor = 'red';
      break;
    case 'CANCELLED':
      borderColor = 'gray';
      break;
    default:
      if (nodeData?.run) {
        borderColor = '#4CAF50';
      }
  }

  const { backgroundColor, ...restStyle } = style || {};

  const cardStyle = React.useMemo(() => ({
    ...restStyle,
    borderColor,
    borderWidth: isSelected
      ? '3px'
      : nodeData?.run
        ? '2px'
        : isHovered
          ? '3px'
          : restStyle.borderWidth || '1px',
    borderStyle: 'solid',
    transition: 'border-color 0.1s, border-width 0.02s',
    pointerEvents: 'auto' as const
  }), [isSelected, nodeData?.run, isHovered, restStyle, borderColor]);

  const acronym = data.acronym || 'N/A';
  const color = data.color || '#ccc';

  const tagStyle = React.useMemo(() => ({
    ...staticStyles.baseTag,
    backgroundColor: color
  }), [color]);

  const headerStyle = React.useMemo(() => ({
    position: 'relative' as const,
    paddingTop: '8px',
    paddingBottom: isCollapsed ? '0px' : '16px',
  }), [isCollapsed]);

  const titleStyle = React.useMemo(() => ({
    marginBottom: isCollapsed ? '4px' : '8px'
  }), [isCollapsed]);

  return (
    <div style={staticStyles.container} draggable={false}>
      {showTitleError && (
        <Alert
          className="absolute -top-16 left-0 right-0 z-50"
          color="danger"
          onClose={() => setShowTitleError(false)}
        >
          Title cannot contain whitespace. Use underscores instead.
        </Alert>
      )}
      {/* Container to hold the Handle and the content */}
      <div>
        {/* Hidden target handle covering the entire node */}
        <Handle
          type="target"
          position={Position.Left}
          id={`node-body-${id}`}
          style={staticStyles.targetHandle}
          isConnectable={true}
          isConnectableStart={false}
        />

        {/* Node content wrapped in drag handle */}
        <div className="react-flow__node-drag-handle" style={staticStyles.dragHandle}>
          <Card
            className={`base-node ${className || ''}`}
            style={cardStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            isHoverable
            classNames={{
              base: "bg-background border-default-200"
            }}
          >
            {data && (
              <CardHeader style={headerStyle}>
                {editingTitle ? (
                  <Input
                    autoFocus
                    value={titleInputValue}
                    size="sm"
                    variant="faded"
                    radius="lg"
                    onChange={(e) => {
                      const validValue = convertToPythonVariableName(e.target.value);
                      setTitleInputValue(validValue);
                      handleTitleChange(validValue);
                    }}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        e.stopPropagation();
                        e.preventDefault();
                        setEditingTitle(false);
                      }
                    }}
                    classNames={{
                      input: 'bg-default-100',
                      inputWrapper: 'shadow-none',
                    }}
                  />
                ) : (
                  <h3
                    className="text-lg font-semibold text-center cursor-pointer hover:text-primary"
                    style={titleStyle}
                    onClick={() => {
                      setTitleInputValue(getNodeTitle(data));
                      setEditingTitle(true);
                    }}
                  >
                    {getNodeTitle(data)}
                  </h3>
                )}

                <div style={staticStyles.controlsContainer}>
                  <Button
                    size="sm"
                    variant="flat"
                    style={staticStyles.collapseButton}
                    onPress={(e) => {

                      setIsCollapsed(!isCollapsed);
                    }}
                  >
                    {isCollapsed ? '▼' : '▲'}
                  </Button>

                  <div style={tagStyle} className="node-acronym-tag">
                    {acronym}
                  </div>
                </div>
              </CardHeader>
            )}
            {!isCollapsed && <Divider />}

            <CardBody className="px-1">
              {children}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Controls */}
      {(showControls || isSelected) && (
        <Card
          onMouseEnter={handleControlsMouseEnter}
          onMouseLeave={handleControlsMouseLeave}
          style={staticStyles.controlsCard}
          classNames={{
            base: "bg-background border-default-200"
          }}
        >
          <div className="flex flex-row gap-1">
            <Button
              isIconOnly
              radius="full"
              variant="light"
              onPress={handlePartialRun}
              disabled={loading}
            >
              <Icon className="text-default-500" icon="solar:play-linear" width={22} />
            </Button>
            {!isInputNode && (
              <Button
                isIconOnly
                radius="full"
                variant="light"
                onPress={handleDelete}
              >
                <Icon className="text-default-500" icon="solar:trash-bin-trash-linear" width={22} />
              </Button>
            )}
            {/* View Output Button */}
            {handleOpenModal && (
              <Button
                isIconOnly
                radius="full"
                variant="light"
                onPress={() => handleOpenModal(true)}
              >
                <Icon className="text-default-500" icon="solar:eye-linear" width={22} />
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default BaseNode;
