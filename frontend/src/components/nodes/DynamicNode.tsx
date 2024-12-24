import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Handle, useHandleConnections, NodeProps, useConnection, Position, useUpdateNodeInternals
} from '@xyflow/react';
import { useSelector, useDispatch } from 'react-redux';
import BaseNode from './BaseNode';
import styles from './DynamicNode.module.css';
import { Input } from '@nextui-org/react';
import {
  updateNodeData,
  updateEdgesOnHandleRename,
  FlowWorkflowNode,
} from '../../store/flowSlice';
import { selectPropertyMetadata } from '../../store/nodeTypesSlice';
import { RootState } from '../../store/store';
import NodeOutputDisplay from './NodeOutputDisplay';
import NodeOutputModal from './NodeOutputModal';
import isEqual from 'lodash/isEqual';

interface NodeData {
  config?: {
    input_schema?: Record<string, any>;
    output_schema?: Record<string, any>;
    system_message?: string;
    user_message?: string;
  };
  title?: string;
  [key: string]: any;
}

interface SchemaMetadata {
  required?: boolean;
  title?: string;
  type?: string;
  [key: string]: any;
}

const updateMessageVariables = (message: string | undefined, oldKey: string, newKey: string): string | undefined => {
  if (!message) return message;
  const regex = new RegExp(`{{\\s*${oldKey}\\s*}}`, 'g');
  return message.replace(regex, `{{${newKey}}}`);
};

interface DynamicNodeProps extends NodeProps {
  id: string;
  type: string;
  data: NodeData;
  position: { x: number; y: number };
  selected?: boolean;
  parentNode?: string;
  displayOutput?: boolean;
}

const nodeComparator = (prevNode: FlowWorkflowNode, nextNode: FlowWorkflowNode) => {
  if (!prevNode || !nextNode) return false;
  // Skip position and measured properties when comparing nodes
  const { position: prevPosition, measured: prevMeasured, ...prevRest } = prevNode;
  const { position: nextPosition, measured: nextMeasured, ...nextRest } = nextNode;
  return isEqual(prevRest, nextRest);
};

const nodesComparator = (prevNodes: FlowWorkflowNode[], nextNodes: FlowWorkflowNode[]) => {
  if (!prevNodes || !nextNodes) return false;
  if (prevNodes.length !== nextNodes.length) return false;
  return prevNodes.every((node, index) => nodeComparator(node, nextNodes[index]));
};

const DynamicNode: React.FC<DynamicNodeProps> = ({ id, type, data, position, displayOutput, ...props }) => {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const [nodeWidth, setNodeWidth] = useState<string>('auto');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const node = useSelector((state: RootState) => state.flow.nodes.find((n) => n.id === id), nodeComparator);
  const nodes = useSelector((state: RootState) => 
    state.flow.nodes.map(node => ({
      id: node.id,
      type: node.type,
      data: {
        config: {
          title: node.data?.config?.title
        }
      }
    })), 
    (prev, next) => {
      if (!prev || !next) return false;
      if (prev.length !== next.length) return false;
      return prev.every((node, index) => 
        node.id === next[index].id && 
        node.type === next[index].type && 
        node.data?.config?.title === next[index].data?.config?.title
      );
    }
  );
  const nodeData = data || (node && node.data);
  const dispatch = useDispatch();

  const edges = useSelector((state: RootState) => state.flow.edges);

  const inputMetadata = useSelector((state: RootState) => selectPropertyMetadata(state, `${type}.input`));
  const outputMetadata = useSelector((state: RootState) => selectPropertyMetadata(state, `${type}.output`));

  const excludeSchemaKeywords = (metadata: SchemaMetadata): Record<string, any> => {
    const schemaKeywords = ['required', 'title', 'type'];
    return Object.keys(metadata).reduce((acc: Record<string, any>, key) => {
      if (!schemaKeywords.includes(key)) {
        acc[key] = metadata[key];
      }
      return acc;
    }, {});
  };

  const cleanedInputMetadata = excludeSchemaKeywords(inputMetadata || {});
  const cleanedOutputMetadata = excludeSchemaKeywords(outputMetadata || {});
  const updateNodeInternals = useUpdateNodeInternals();

  const handleSchemaKeyEdit = useCallback(
    (oldKey: string, newKey: string, schemaType: 'input_schema' | 'output_schema') => {
      newKey = newKey.replace(/\s+/g, '_');
      if (oldKey === newKey || !newKey.trim()) {
        setEditingField(null);
        return;
      }

      const currentSchema = nodeData?.config?.[schemaType] || {};
      const schemaEntries = Object.entries(currentSchema);
      const keyIndex = schemaEntries.findIndex(([key]) => key === oldKey);

      if (keyIndex !== -1) {
        schemaEntries[keyIndex] = [newKey, currentSchema[oldKey]];
      }

      const updatedSchema = Object.fromEntries(schemaEntries);

      let updatedConfig = {
        ...nodeData?.config,
        [schemaType]: updatedSchema,
      };

      if (schemaType === 'input_schema') {
        if (nodeData?.config?.system_message) {
          updatedConfig.system_message = updateMessageVariables(
            nodeData.config.system_message,
            oldKey,
            newKey
          );
        }
        if (nodeData?.config?.user_message) {
          updatedConfig.user_message = updateMessageVariables(
            nodeData.config.user_message,
            oldKey,
            newKey
          );
        }
      }

      dispatch(
        updateNodeData({
          id,
          data: {
            config: updatedConfig,
          },
        })
      );

      dispatch(
        updateEdgesOnHandleRename({
          nodeId: id,
          oldHandleId: oldKey,
          newHandleId: newKey,
          schemaType,
        })
      );

      setEditingField(null);
    },
    [dispatch, id, nodeData]
  );

  useEffect(() => {
    if (!nodeRef.current || !nodeData) return;

    const inputLabels = predecessorNodes.map((node) =>
      String(node?.data?.config?.title || node?.id || '')
    );
    const outputLabels = nodeData?.config?.title ? [String(nodeData.config.title)] : [String(id)];

    const maxInputLabelLength = inputLabels.reduce((max, label) => Math.max(max, label.length), 0);
    const maxOutputLabelLength = outputLabels.reduce((max, label) => Math.max(max, label.length), 0);
    const titleLength = ((nodeData?.title || '').length + 10) * 1.25;

    const maxLabelLength = Math.max(
      (maxInputLabelLength + maxOutputLabelLength + 5),
      titleLength
    );

    const minNodeWidth = 300;
    const maxNodeWidth = 600;

    const finalWidth = Math.min(
      Math.max(maxLabelLength * 10, minNodeWidth),
      maxNodeWidth
    );
    if (nodeWidth !== `${finalWidth}px`) {
      console.log('Setting node width to:', finalWidth, 'original:', nodeWidth);
      setNodeWidth(`${finalWidth}px`);
    }
  }, [nodeData, cleanedInputMetadata, cleanedOutputMetadata, predecessorNodes, nodeWidth]);

  interface HandleRowProps {
    id: string;
    keyName: string;
  }

  const InputHandleRow: React.FC<HandleRowProps> = ({ id, keyName }) => {
    const connections = useHandleConnections({ type: 'target', id: keyName });
    const isConnectable = !isCollapsed && (connections.length === 0 || String(keyName).startsWith('branch'));

    return (
      <div className={`${styles.handleRow} w-full justify-end`} key={keyName} id={`input-${keyName}-row`}>
        <div className={`${styles.handleCell} ${styles.inputHandleCell}`} id={`input-${keyName}-handle`}>
          <Handle
            type="target"
            position={Position.Left}
            id={String(keyName)}
            className={`${styles.handle} ${styles.handleLeft} ${isCollapsed ? styles.collapsedHandleInput : ''}`}
            isConnectable={isConnectable}
          />
        </div>
        <div className="border-r border-gray-300 h-full mx-0"></div>
        {!isCollapsed && (
          <div className="align-center flex flex-grow flex-shrink ml-[0.5rem] max-w-full overflow-hidden" id={`input-${keyName}-label`}>
            {editingField === keyName ? (
              <Input
                autoFocus
                defaultValue={String(keyName)}
                size="sm"
                variant="faded"
                radius="lg"
                classNames={{
                  input: 'bg-default-100',
                  inputWrapper: 'shadow-none',
                }}
              />
            ) : (
              <span
                className={`${styles.handleLabel} text-sm font-medium cursor-pointer hover:text-primary mr-auto overflow-hidden text-ellipsis whitespace-nowrap`}
              >
                {String(keyName)}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const OutputHandleRow: React.FC<HandleRowProps> = ({ keyName }) => {
    return (
      <div className={`${styles.handleRow} w-full justify-end`} key={`output-${keyName}`} id={`output-${keyName}-row`} >
        {!isCollapsed && (
          <div className="align-center flex flex-grow flex-shrink mr-[0.5rem] max-w-full overflow-hidden" id={`output-${keyName}-label`}>
            {editingField === keyName ? (
              <Input
                autoFocus
                defaultValue={keyName}
                size="sm"
                variant="faded"
                radius="lg"
                classNames={{
                  input: 'bg-default-100',
                  inputWrapper: 'shadow-none',
                }}
              />
            ) : (
              <span
                className={`${styles.handleLabel} text-sm font-medium cursor-pointer hover:text-primary ml-auto overflow-hidden text-ellipsis whitespace-nowrap`}
              >
                {keyName}
              </span>
            )}
          </div>
        )}
        <div className="border-l border-gray-300 h-full mx-0"></div>
        <div className={`${styles.handleCell} ${styles.outputHandleCell}`} id={`output-${keyName}-handle`}>
          <Handle
            type="source"
            position={Position.Right}
            id={keyName}
            className={`${styles.handle} ${styles.handleRight} ${isCollapsed ? styles.collapsedHandleOutput : ''
              }`}
            isConnectable={!isCollapsed}
          />
        </div>
      </div>
    );
  };

  const [predecessorNodes, setPredcessorNodes] = useState(() => {
    return edges
      .filter((edge) => edge.target === id)
      .map((edge) => {
        const sourceNode = nodes.find((node) => node.id === edge.source);
        if (!sourceNode) return null;
        console.log('sourceNode', sourceNode.type === 'RouterNode', edge.sourceHandle);
        if (sourceNode.type === 'RouterNode' && edge.sourceHandle) {
          return {
            id: sourceNode.id,
            type: sourceNode.type,
            data: {
              config: {
                title: edge.source + '_' + edge.sourceHandle
              }
            }
          };
        }
        return sourceNode;
      })
      .filter(Boolean);
  });

  const connection = useConnection();

  // Compute finalPredecessors using useMemo to avoid unnecessary computations:
  const finalPredecessors = useMemo(() => {
    const updatedPredecessorNodes = edges
      .filter((edge) => edge.target === id)
      .map((edge) => {
        const sourceNode = nodes.find((node) => node.id === edge.source);
        if (!sourceNode) return null;
        if (sourceNode.type === 'RouterNode' && edge.sourceHandle) {
          return {
            id: sourceNode.id,
            type: sourceNode.type,
            data: {
              config: {
                title: edge.source + '_' + edge.sourceHandle
              }
            }
          };
        }
        return sourceNode;
      })
      .filter(Boolean);

    let result = updatedPredecessorNodes;

    if (connection.inProgress && connection.toNode && connection.toNode.id === id) {
      if (connection.fromNode && !updatedPredecessorNodes.find((node: any) => node.id === connection.fromNode.id)) {
        if (connection.fromNode.type === 'RouterNode' && connection.fromHandle) {
          console.log('connection', connection);
          result = [...updatedPredecessorNodes, {
            id: connection.fromNode.id,
            type: connection.fromNode.type,
            data: {
              config: {
                title: connection.fromHandle.nodeId + '_' + connection.fromHandle.id
              }
            }
          }];
        } else {
          result = [...updatedPredecessorNodes, connection.fromNode];
        }
      }
    }
    return result;
  }, [edges, nodes, connection, id]);

  useEffect(() => {
    // Check if finalPredecessors differ from predecessorNodes
    // (We do a deeper comparison to detect config/title changes, not just ID changes)
    const hasChanged = finalPredecessors.length !== predecessorNodes.length ||
      finalPredecessors.some((newNode, i) => !isEqual(newNode, predecessorNodes[i]));

    if (hasChanged) {
      setPredcessorNodes(finalPredecessors);
      updateNodeInternals(id);
    }
  }, [finalPredecessors, predecessorNodes, updateNodeInternals, id]);

  const isRouterNode = type === 'RouterNode';

  const renderHandles = () => {
    if (!nodeData) return null;

    return (
      <div className={`${styles.handlesWrapper}`} id="handles">
        {/* Input Handles */}
        <div className={`${styles.handlesColumn} ${styles.inputHandlesColumn}`} id="input-handles">
          {predecessorNodes.map((node) => {
            const handleId = String(node.data?.config?.title || node.id || '');
            return (
              <InputHandleRow
                id={node.id}
                keyName={handleId}
                key={handleId}
              />
            );
          })}
        </div>

        {/* Output Handles */}
        <div className={`${styles.handlesColumn} ${styles.outputHandlesColumn}`} id="output-handle">
          {nodeData?.title && (
            <OutputHandleRow
              keyName={String(nodeData.config.title || id)}
            />
          )}
        </div>
      </div>
    );
  };

  const baseNodeStyle = useMemo(() => ({
    width: nodeWidth,
  }), [nodeWidth]);

  return (
    <>
      <div
        className={styles.dynamicNodeWrapper}
        style={{ zIndex: props.parentNode ? 1 : 0 }}
      >
        <BaseNode
          id={id}
          data={nodeData}
          style={baseNodeStyle}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          selected={props.selected}
          handleOpenModal={setIsModalOpen}
          className="hover:!bg-background"
        >
          <div className={styles.nodeWrapper} ref={nodeRef} id={`node-${id}-wrapper`}>
            {isRouterNode ? (
              <div>
                <strong>Conditional Node</strong>
              </div>
            ) : null}
            {renderHandles()}
          </div>
          {displayOutput && <NodeOutputDisplay output={nodeData.run} />}
        </BaseNode>
      </div>
      <NodeOutputModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={data?.config?.title || data?.title || 'Node Output'}
        node={node}
        data={nodeData}
      />
    </>
  );
};

export default DynamicNode;
