import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useDispatch, useSelector } from 'react-redux';
import BaseNode from './BaseNode';
import {
  updateNodeTitle,
  CanvasNode,
  CanvasEdge
} from '../../store/canvasSlice';
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
  };
  [key: string]: any;
}

const InputNode: React.FC<InputNodeProps> = ({ id, data, ...props }) => {
  const dispatch = useDispatch();
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const [nodeWidth, setNodeWidth] = useState<string>('auto');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [showKeyError, setShowKeyError] = useState<boolean>(false);

  const incomingEdges = useSelector((state: RootState) => state.canvas.edges.filter((edge) => edge.target === id));

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
  }, [data, nodeWidth]);

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

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      const validTitle = convertToPythonVariableName(newTitle);
      if (validTitle && validTitle !== data.title) {
        dispatch(updateNodeTitle({ nodeId: id, newTitle: validTitle }));
      }
    },
    [dispatch, id, data.title]
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
        </div>
      </BaseNode>
    </div>
  );
};

export default InputNode;