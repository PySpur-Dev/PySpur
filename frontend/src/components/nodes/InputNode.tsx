import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useDispatch, useSelector } from 'react-redux';
import BaseNode from './BaseNode';
import {
  updateNodeTitle,
  CanvasNode,
  CanvasEdge,
  updateEdgesOnHandleRename
} from '../../store/canvasSlice';
import { updateNodeData, updateJinjaTemplateReferences } from '../../store/nodeDataSlice';
import { Input, Button, Alert } from '@nextui-org/react';
import { Icon } from '@iconify/react';
import styles from './InputNode.module.css';
import { RootState } from '../../store/store';

interface InputNodeProps {
  id: string;
  data: {
    title: string;
    acronym: string;
    color: string;
    config?: {
      output_schema?: Record<string, any>;
    };
  };
  [key: string]: any;
}

const InputNode: React.FC<InputNodeProps> = ({ id, data, ...props }) => {
  const dispatch = useDispatch();
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const [nodeWidth, setNodeWidth] = useState<string>('auto');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [newFieldValue, setNewFieldValue] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [showKeyError, setShowKeyError] = useState<boolean>(false);

  const incomingEdges = useSelector((state: RootState) => state.canvas.edges.filter((edge) => edge.target === id));
  const outputSchema = data?.config?.output_schema || {};
  const outputSchemaKeys = Object.keys(outputSchema);

  useEffect(() => {
    if (nodeRef.current) {
      const incomingSchemaKeys = incomingEdges.map((edge) => edge.source);
      const maxLabelLength = Math.max(
        Math.max(...incomingSchemaKeys.map((label) => label.length)),
        (data?.title || '').length / 1.5
      );

      const calculatedWidth = Math.max(300, maxLabelLength * 15);
      const finalWidth = Math.min(calculatedWidth, 600);
      if (finalWidth !== parseInt(nodeWidth)) {
        setNodeWidth(`${finalWidth}px`);
      }
    }
  }, [data, nodeWidth, incomingEdges]);

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

  const handleAddWorkflowInputVariable = useCallback(() => {
    if (!newFieldValue.trim()) return;
    const newKey = convertToPythonVariableName(newFieldValue.trim());

    if (newKey !== newFieldValue.trim()) {
      setShowKeyError(true);
      setTimeout(() => setShowKeyError(false), 3000);
    }

    const newOutputSchema = {
      ...outputSchema,
      [newKey]: 'str'
    };

    dispatch(updateNodeData({
      nodeId: id,
      newConfigFields: {
        config: {
          ...data.config,
          output_schema: newOutputSchema
        }
      }
    }));
    setNewFieldValue('');
  }, [dispatch, newFieldValue, outputSchema, data.config, id]);

  const handleDeleteWorkflowInputVariable = useCallback(
    (keyToDelete: string) => {
      const newOutputSchema = { ...outputSchema };
      delete newOutputSchema[keyToDelete];

      // Update node data
      dispatch(updateNodeData({
        nodeId: id,
        newConfigFields: {
          config: {
            ...data.config,
            output_schema: newOutputSchema
          }
        }
      }));

      // Update edges and canvas node data
      dispatch(updateEdgesOnHandleRename({
        nodeId: id,
        oldHandleId: keyToDelete,
        newHandleId: '', // Empty string since we're deleting
        schemaType: 'output_schema'
      }));
    },
    [dispatch, outputSchema, data.config, id]
  );

  const handleWorkflowInputVariableKeyEdit = useCallback(
    (oldKey: string, newKey: string) => {
      if (oldKey === newKey || !newKey.trim()) {
        setEditingField(null);
        return;
      }

      const validKey = convertToPythonVariableName(newKey);
      if (validKey !== newKey) {
        setShowKeyError(true);
        setTimeout(() => setShowKeyError(false), 3000);
      }

      const newOutputSchema = { ...outputSchema };
      newOutputSchema[validKey] = newOutputSchema[oldKey];
      delete newOutputSchema[oldKey];

      // Update node data
      dispatch(updateNodeData({
        nodeId: id,
        newConfigFields: {
          config: {
            ...data.config,
            output_schema: newOutputSchema
          }
        }
      }));

      // Update edges
      dispatch(updateEdgesOnHandleRename({
        nodeId: id,
        oldHandleId: oldKey,
        newHandleId: validKey,
        schemaType: 'output_schema'
      }));

      // Update Jinja template references in all downstream nodes
      dispatch(updateJinjaTemplateReferences({
        inputNodeId: id,
        inputNodeTitle: data.title || id,
        oldVariableName: oldKey,
        newVariableName: validKey
      }));

      setEditingField(null);
    },
    [dispatch, outputSchema, data.config, data.title, id]
  );

  const InputHandleRow: React.FC<{ id: string; keyName: string }> = ({ id, keyName }) => {
    return (
      <div className={`flex overflow-hidden w-full justify-end whitespace-nowrap items-center`} key={keyName} id={`input-${keyName}-row`}>
        <div className={`${styles.handleCell} ${styles.inputHandleCell}`} id={`input-${keyName}-handle`}>
          <Handle
            type="target"
            position={Position.Left}
            id={keyName}
            className={`${styles.handle} ${styles.handleLeft} ${isCollapsed ? styles.collapsedHandleInput : ''}`}
            isConnectable={!isCollapsed}
          />
        </div>
        <div className="border-r border-gray-300 h-full mx-0"></div>
        {!isCollapsed && (
          <div className="align-center flex flex-grow flex-shrink ml-[0.5rem] max-w-full overflow-hidden" id={`input-${keyName}-label`}>
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
                className={`${styles.handleLabel} text-sm font-medium cursor-pointer hover:text-primary mr-auto overflow-hidden text-ellipsis whitespace-nowrap`}
              >
                {keyName}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderWorkflowInputs = () => {
    return (
      <div className="flex w-full flex-row" id="handles">
        {incomingEdges.length > 0 && (
          <div className={`${styles.handlesColumn} ${styles.inputHandlesColumn}`} id="input-handles">
            {incomingEdges.map((edge) => (
              <InputHandleRow key={edge.source} id={edge.source} keyName={edge.source} />
            ))}
          </div>
        )}
        <div className={`${styles.handlesColumn} border-r mr-1`}>
          {outputSchemaKeys.length > 0 && (
            <table style={{ width: '100%' }}>
              <tbody>
                {outputSchemaKeys.map((key) => (
                  <tr key={key} className="relative w-full px-4 py-2">
                    <td className={styles.handleLabelCell}>
                      {!isCollapsed && (
                        <div className="flex items-center gap-2">
                          {editingField === key ? (
                            <Input
                              autoFocus
                              defaultValue={key}
                              size="sm"
                              variant="faded"
                              radius="lg"
                              onBlur={(e) => {
                                const target = e.target as HTMLInputElement;
                                handleWorkflowInputVariableKeyEdit(key, target.value);
                              }}
                              onChange={(e) => {
                                const target = e.target as HTMLInputElement;
                                const validValue = convertToPythonVariableName(target.value);
                                if (validValue !== target.value) {
                                  target.value = validValue;
                                  setShowKeyError(true);
                                  setTimeout(() => setShowKeyError(false), 3000);
                                }
                              }}
                              onKeyDown={(e) => {
                                const target = e.target as HTMLInputElement;
                                if (e.key === 'Enter') {
                                  handleWorkflowInputVariableKeyEdit(key, target.value);
                                } else if (e.key === 'Escape') {
                                  setEditingField(null);
                                }
                              }}
                              classNames={{
                                input: 'bg-default-100',
                                inputWrapper: 'shadow-none',
                              }}
                            />
                          ) : (
                            <div className="flex flex-col w-full gap-1">
                              <div className="flex items-center justify-between">
                                <span
                                  className={`${styles.handleLabel} text-sm font-medium cursor-pointer hover:text-primary`}
                                  onClick={() => setEditingField(key)}
                                >
                                  {key}
                                </span>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  onClick={() => handleDeleteWorkflowInputVariable(key)}
                                >
                                  <Icon icon="solar:trash-bin-minimalistic-linear" width={16} />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="right-0 w-4 items-center justify-center flex">
          <Handle
            type="source"
            position={Position.Right}
            id={id}
            className={`${styles.handle} ${styles.handleRight} ${isCollapsed ? styles.collapsedHandleOutput : ''}`}
            isConnectable={!isCollapsed}
          />
        </div>
      </div>
    );
  };

  const renderAddField = () =>
    !isCollapsed && (
      <div className="flex items-center gap-2 px-4 py-2">
        <Input
          placeholder="Enter new field name"
          value={newFieldValue}
          onChange={(e) => {
            const validValue = convertToPythonVariableName(e.target.value);
            if (validValue !== e.target.value) {
              setShowKeyError(true);
              setTimeout(() => setShowKeyError(false), 3000);
            }
            setNewFieldValue(validValue);
          }}
          size="sm"
          variant="faded"
          radius="lg"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleAddWorkflowInputVariable();
            }
          }}
          classNames={{
            input: "bg-background",
            inputWrapper: "shadow-none bg-background"
          }}
          endContent={
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onClick={handleAddWorkflowInputVariable}
              className="text-default-400 hover:text-default-500"
            >
              <Icon icon="solar:add-circle-bold" width={16} className="text-default-500" />
            </Button>
          }
        />
      </div>
    );

  return (
    <div className={styles.inputNodeWrapper}>
      {showKeyError && (
        <Alert
          className="absolute -top-16 left-0 right-0 z-50"
          color="danger"
          onClose={() => setShowKeyError(false)}
        >
          Variable names cannot contain whitespace. Using underscores instead.
        </Alert>
      )}
      <BaseNode
        id={id}
        isInputNode={true}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        data={{
          ...data,
          acronym: 'IN',
          color: '#2196F3',
        }}
        style={{ width: nodeWidth }}
        className="hover:!bg-background"
        {...props}
      >
        <div className={styles.nodeWrapper} ref={nodeRef}>
          {renderWorkflowInputs()}
          {renderAddField()}
        </div>
      </BaseNode>
    </div>
  );
};

export default InputNode;