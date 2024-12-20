import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import {
  updateNodeData,
  updateTitleInEdges,
  selectNodeById,
  setSidebarWidth,
  setSelectedNode,
  FlowWorkflowNode,
  updateNodeTitle,
} from '../../../store/flowSlice';
import NumberInput from '../../NumberInput';
import CodeEditor from '../../CodeEditor';
import { jsonOptions } from '../../../constants/jsonOptions';
import FewShotEditor from '../../textEditor/FewShotEditor';
import TextEditor from '../../textEditor/TextEditor';
import {
  Button,
  Slider,
  Switch,
  Textarea,
  Input,
  Select,
  SelectItem,
  Accordion,
  AccordionItem,
  Card,
  Alert,
} from "@nextui-org/react";
import { Icon } from '@iconify/react';
import NodeOutput from '../NodeOutputDisplay';
import SchemaEditor from './SchemaEditor';
import { selectPropertyMetadata } from '../../../store/nodeTypesSlice';
import { cloneDeep, set, debounce } from 'lodash';
import RouterEditor from './RouterEditor';
import MergeEditor from './MergeEditor';
import isEqual from 'lodash/isEqual';
// Define types for props and state
interface NodeSidebarProps {
  nodeID: string;
}

interface NodeSchema {
  name: string;
  config: {
    [key: string]: any;
    title?: string;
    type?: string;
    input_schema?: Record<string, any>;
    output_schema?: Record<string, any>;
    system_message?: string;
    user_message?: string;
    few_shot_examples?: Array<{
      input: string;
      output: string;
    }>;
  };
}

interface DynamicModel {
  [key: string]: any;
  title?: string;
  type?: string;
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
  system_message?: string;
  user_message?: string;
  few_shot_examples?: Array<{
    input: string;
    output: string;
  }>;
  branch_refs?: string[];
  input_schemas?: Record<string, any>;
}

interface FieldMetadata {
  enum?: string[];
  default?: any;
  title?: string;
  minimum?: number;
  maximum?: number;
  type?: string;
}

interface NodeType {
  name: string;
  config: Record<string, any>;
}

interface NodeData {
  config: DynamicModel;
  run?: any;
  type?: string;
  id?: string;
}

interface Node {
  type: string;
  id: string;
  data: NodeData;
}

type NodeTypes = Record<string, NodeType[]>;

// Update the `findNodeSchema` function to resolve the "used before declaration" error
const findNodeSchema = (nodeType: string, nodeTypes: NodeTypes): NodeSchema | null => {
  if (!nodeTypes) return null;

  for (const category in nodeTypes) {
    const nodeSchema = nodeTypes[category]?.find((n: NodeType) => n.name === nodeType);
    if (nodeSchema) {
      return nodeSchema;
    }
  }
  return null;
};

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

// Add the utility function near the top of the file
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

const NodeSidebar: React.FC<NodeSidebarProps> = ({ nodeID }) => {
  const dispatch = useDispatch();
  const nodes = useSelector((state: RootState) => state.flow.nodes, nodesComparator);
  const edges = useSelector((state: RootState) => state.flow.edges, isEqual);
  const nodeTypes = useSelector((state: RootState) => state.nodeTypes.data, isEqual);
  const node = useSelector((state: RootState) => selectNodeById(state, nodeID), nodeComparator);
  const storedWidth = useSelector((state: RootState) => state.flow.sidebarWidth, isEqual);
  const metadata = useSelector((state: RootState) => state.nodeTypes.metadata, isEqual);

  const hasRunOutput = !!node?.data?.run;

  const [width, setWidth] = useState<number>(storedWidth);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  const [nodeType, setNodeType] = useState<string>(node?.type || 'ExampleNode');
  const [nodeSchema, setNodeSchema] = useState<NodeSchema | null>(
    findNodeSchema(node?.type || 'ExampleNode', nodeTypes)
  );
  const [dynamicModel, setDynamicModel] = useState<DynamicModel>(node?.data?.config || {});
  const [fewShotIndex, setFewShotIndex] = useState<number | null>(null);
  const [showTitleError, setShowTitleError] = useState(false);
  const [titleInputValue, setTitleInputValue] = useState<string>('');

  const collectIncomingSchema = (nodeID: string): string[] => {
    const incomingEdges = edges.filter((edge) => edge.target === nodeID);
    const incomingNodes = incomingEdges.map((edge) => nodes.find((n) => n.id === edge.source));
    // foreach incoming node, get the output schema
    // return ['nodeTitle.foo', 'nodeTitle.bar', 'nodeTitle.baz',...]
    return incomingNodes.reduce((acc: string[], node) => {
      if (node?.data?.config?.output_schema) {
        const nodeTitle = node.data.config.title || node.id;
        return [
          ...acc,
          ...Object.keys(node.data.config.output_schema).map((key) => `${nodeTitle}.${key}`),
        ];
      }
      return acc;
    }, []);
  }
  const [incomingSchema, setIncomingSchema] = useState<string[]>(
    collectIncomingSchema(nodeID)
  );

  useEffect(() => {
    setIncomingSchema(collectIncomingSchema(nodeID));
  }
    , [nodeID, nodes, edges]);

  // Create a debounced version of the dispatch update
  const debouncedDispatch = useCallback(
    debounce((id: string, updatedModel: DynamicModel) => {
      dispatch(updateNodeData({ id, data: { config: updatedModel } }));
    }, 300),
    [dispatch]
  );

  // Add this useEffect to handle title initialization and updates
  useEffect(() => {
    if (node) {
      setTitleInputValue(node.data?.config?.title || node.id || '');
    }
  }, [node]); // Only depend on node changes

  // Update the existing useEffect to remove the title setting
  useEffect(() => {
    if (node) {
      setNodeType(node.type || 'ExampleNode');
      setNodeSchema(findNodeSchema(node.type || 'ExampleNode', nodeTypes));
      setDynamicModel(node.data?.config || {});
    }
  }, [nodeID, node, nodeTypes]);

  // Helper function to update nested object by path
  const updateNestedModel = (obj: DynamicModel, path: string, value: any): DynamicModel => {
    const deepClone = cloneDeep(obj);
    set(deepClone, path, value);
    return deepClone;
  };

  // Update the input change handler to use local state immediately but debounce Redux updates for Slider
  const handleInputChange = (key: string, value: any, isSlider: boolean = false) => {
    let updatedModel: DynamicModel;

    if (key.includes('.')) {
      updatedModel = updateNestedModel(dynamicModel, key, value);
    } else {
      updatedModel = { ...dynamicModel, [key]: value };
    }

    setDynamicModel(updatedModel);

    if (isSlider) {
      debouncedDispatch(nodeID, updatedModel);
    } else {
      dispatch(updateNodeData({ id: nodeID, data: { config: updatedModel } }));
    }
  };


  // Update the handleNodeTitleChange function
  const handleNodeTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const validTitle = convertToPythonVariableName(e.target.value);
    setTitleInputValue(validTitle);
    dispatch(updateNodeTitle({ nodeId: nodeID, newTitle: validTitle }));
  };

  const renderEnumSelect = (
    key: string,
    label: string,
    enumValues: string[],
    fullPath: string,
    defaultSelected?: string
  ) => {
    const lastTwoDots = fullPath.split('.').slice(-2).join('.');
    return (
      <div key={key}>
        <Select
          label={label}
          defaultSelectedKeys={[defaultSelected || dynamicModel[key] || '']}
          onChange={(e) => handleInputChange(lastTwoDots, e.target.value)}
          fullWidth
        >
          {enumValues.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </Select>
      </div>
    );
  };

  const handleAddNewExample = () => {
    const updatedExamples = [...(dynamicModel?.few_shot_examples || []), { input: '', output: '' }];
    handleInputChange('few_shot_examples', updatedExamples);
    setFewShotIndex(updatedExamples.length - 1);
  };

  const handleDeleteExample = (index: number) => {
    const updatedExamples = [...(dynamicModel?.few_shot_examples || [])];
    updatedExamples.splice(index, 1);
    handleInputChange('few_shot_examples', updatedExamples);
  };

  // Update the `getFieldMetadata` function
  const getFieldMetadata = (fullPath: string): FieldMetadata | undefined => {
    return selectPropertyMetadata({ nodeTypes: { metadata } }, fullPath);
  };

  // Update the `renderField` function to include missing cases
  const renderField = (
    key: string,
    field: any,
    value: any,
    parentPath: string = '',
    isLast: boolean = false
  ) => {
    const fullPath = `${parentPath ? `${parentPath}.` : ''}${key}`;
    const fieldMetadata = getFieldMetadata(fullPath);

    // Skip api_base field if the selected model is not an Ollama model
    if (key === 'api_base') {
      const modelValue = dynamicModel?.llm_info?.model;
      if (!modelValue || !modelValue.toString().startsWith('ollama/')) {
        return null;
      }
      // Add default value for Ollama models
      return (
        <div key={key} className="my-4">
          <Input
            fullWidth
            label={fieldMetadata?.title || key}
            value={value || "http://localhost:11434"}
            onChange={(e) => handleInputChange(key, e.target.value)}
            placeholder="Enter API base URL"
          />
          {!isLast && <hr className="my-2" />}
        </div>
      );
    }

    // Handle enum fields
    if (fieldMetadata?.enum) {
      const defaultSelected = value || fieldMetadata.default;
      return renderEnumSelect(key, fieldMetadata.title || key, fieldMetadata.enum, fullPath, defaultSelected);
    }

    // Handle specific cases for input_schema, output_schema, and system_prompt
    if (key === 'input_schema') {
      return (
        <div key={key} className="my-2">
          <label className="font-semibold mb-1 block">Input Schema</label>
          <SchemaEditor
            jsonValue={dynamicModel.input_schema || {}}
            onChange={(newValue) => {
              handleInputChange('input_schema', newValue);
            }}
            options={jsonOptions}
            schemaType="input_schema"
            nodeId={nodeID}
          />
          {!isLast && <hr className="my-2" />}
        </div>
      );
    }

    // Add routes editor for conditional nodes
    if (key === 'routes') {
      return (
        <div key={key} className="my-2">
          <label className="font-semibold mb-1 block">Conditional Routes</label>
          <RouterEditor
            routes={dynamicModel.routes || []}
            onChange={(newRoutes) => {
              handleInputChange('routes', newRoutes);
            }}
            inputSchema={dynamicModel.input_schema || {}}
            disabled={false}
          />
          {!isLast && <hr className="my-2" />}
        </div>
      );
    }
    if (key === 'input_schemas' && nodeType === 'MergeNode') {
      return (
        <div key={key} className="my-2">
          <label className="font-semibold mb-1 block">Input Schemas</label>
          <MergeEditor
            branchRefs={dynamicModel.branch_refs || []}
            onChange={(newValue) => {
              handleInputChange('branch_refs', newValue);
            }}
            nodeId={nodeID}
          />
          {!isLast && <hr className="my-2" />}
        </div>
      );
    }

    if (key === 'output_schema') {
      return (
        <div key={key} className="my-2">
          <label className="font-semibold mb-1 block">Output Schema</label>
          <SchemaEditor
            jsonValue={dynamicModel.output_schema || {}}
            onChange={(newValue) => {
              handleInputChange('output_schema', newValue);
            }}
            options={jsonOptions}
            schemaType="output_schema"
            nodeId={nodeID}
          />
          {!isLast && <hr className="my-2" />}
        </div>
      );
    }

    if (key === 'system_message') {
      return (
        <div key={key}>
          <TextEditor
            key={key}
            nodeID={nodeID}
            fieldName={key}
            inputSchema={incomingSchema}
            fieldTitle="System Message"
            content={dynamicModel[key] || ''}
            setContent={(value: string) => handleInputChange(key, value)}
          />
          {!isLast && <hr className="my-2" />}
        </div>
      );
    }

    if (key === 'user_message') {
      return (
        <div key={key}>
          <TextEditor
            key={key}
            nodeID={nodeID}
            fieldName={key}
            inputSchema={incomingSchema}
            fieldTitle="User Message"
            content={dynamicModel[key] || ''}
            setContent={(value) => handleInputChange(key, value)}
          />
          {renderFewShotExamples()}
          {!isLast && <hr className="my-2" />}
        </div>
      );
    }

    if (key.endsWith('_prompt') || key.endsWith('_message')) {
      return (
        <div key={key}>
          <TextEditor
            key={key}
            nodeID={nodeID}
            fieldName={key}
            inputSchema={incomingSchema}
            fieldTitle={key}
            content={dynamicModel[key] || ''}
            setContent={(value) => handleInputChange(key, value)}
          />
          {!isLast && <hr className="my-2" />}
        </div>
      );
    }

    if (key === 'code') {
      return (
        <CodeEditor
          key={key}
          code={value}
          onChange={(newValue: string) => handleInputChange(key, newValue)}
        />
      );
    }

    // Handle other types (string, number, boolean, object)
    switch (typeof field) {
      case 'string':
        return (
          <div key={key} className="my-4">
            <Textarea
              fullWidth
              label={fieldMetadata?.title || key}
              value={value}
              onChange={(e) => handleInputChange(key, e.target.value)}
              placeholder="Enter your input"
            />
            {!isLast && <hr className="my-2" />}
          </div>
        );
      case 'number':
        if (fieldMetadata && (fieldMetadata.minimum !== undefined || fieldMetadata.maximum !== undefined)) {
          const min = fieldMetadata.minimum ?? 0;
          const max = fieldMetadata.maximum ?? 100;

          return (
            <div key={key} className="my-4">
              <div className="flex justify-between items-center mb-2">
                <label className="font-semibold">{fieldMetadata.title || key}</label>
                <span className="text-sm">{value}</span>
              </div>
              <Slider
                aria-label={fieldMetadata.title || key}
                value={value}
                minValue={min}
                maxValue={max}
                step={fieldMetadata.type === 'integer' ? 1 : 0.1}
                className="w-full"
                onChange={(newValue) => {
                  const path = parentPath ? `${parentPath}.${key}` : key;
                  const lastTwoDots = path.split('.').slice(-2);
                  const finalPath = lastTwoDots[0] === 'config' ? lastTwoDots[1] : lastTwoDots.join('.');
                  handleInputChange(finalPath, newValue, true);
                }}
              />
              {!isLast && <hr className="my-2" />}
            </div>
          );
        }
        return (
          <NumberInput
            key={key}
            label={key}
            value={value}
            onChange={(e) => {
              const newValue = parseFloat(e.target.value);
              handleInputChange(key, isNaN(newValue) ? 0 : newValue);
            }}
          />
        );
      case 'boolean':
        return (
          <div key={key} className="my-4">
            <div className="flex justify-between items-center">
              <label className="font-semibold">{fieldMetadata?.title || key}</label>
              <Switch
                checked={value}
                onChange={(e) => handleInputChange(key, e.target.checked)}
              />
            </div>
            {!isLast && <hr className="my-2" />}
          </div>
        );
      case 'object':
        if (field && typeof field === 'object' && !Array.isArray(field)) {
          return (
            <div key={key} className="my-2">
              {Object.keys(field).map((subKey) => renderField(subKey, field[subKey], value?.[subKey], fullPath))}
              {!isLast && <hr className="my-2" />}
            </div>
          );
        }
        return null;
      default:
        return null;
    }
  };

  // Update the `renderConfigFields` function to include missing logic
  const renderConfigFields = () => {
    if (!nodeSchema || !nodeSchema.config || !dynamicModel) return null;
    const properties = nodeSchema.config;
    const keys = Object.keys(properties).filter((key) => key !== 'title' && key !== 'type');

    // Special handling for MergeNode
    if (nodeType === 'MergeNode') {
      return (
        <MergeEditor
          branchRefs={dynamicModel.branch_refs || []}
          onChange={(newBranchRefs) => {
            const updatedModel = {
              ...dynamicModel,
              branch_refs: newBranchRefs,
            };
            setDynamicModel(updatedModel);
            dispatch(updateNodeData({ id: nodeID, data: { config: updatedModel } }));
          }}
          nodeId={nodeID}
        />
      );
    }

    // Prioritize system_message and user_message to appear first
    const priorityFields = ['system_message', 'user_message'];
    const remainingKeys = keys.filter(key => !priorityFields.includes(key));
    const orderedKeys = [...priorityFields.filter(key => keys.includes(key)), ...remainingKeys];

    return orderedKeys.map((key, index) => {
      const field = properties[key];
      const value = dynamicModel[key];
      const isLast = index === orderedKeys.length - 1;
      return renderField(key, field, value, `${nodeType}.config`, isLast);
    });
  };

  // Update the `renderFewShotExamples` function
  const renderFewShotExamples = () => {
    const fewShotExamples = node?.data?.config?.few_shot_examples || [];

    return (
      <div>
        {fewShotIndex !== null ? (
          <FewShotEditor
            nodeID={nodeID}
            exampleIndex={fewShotIndex}
            onSave={() => setFewShotIndex(null)}
            onDiscard={() => setFewShotIndex(null)}
          />
        ) : (
          <div>
            <h3 className="my-2 font-semibold">Few Shot Examples</h3>
            <div className="flex flex-wrap gap-2">
              {fewShotExamples.map((example, index) => (
                <div
                  key={`few-shot-${index}`}
                  className="flex items-center space-x-2 p-2 bg-gray-100 rounded-full cursor-pointer"
                  onClick={() => setFewShotIndex(index)}
                >
                  <span>Example {index + 1}</span>
                  <Button
                    isIconOnly
                    radius="full"
                    variant="light"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteExample(index);
                    }}
                    color="primary"
                  >
                    <Icon icon="solar:trash-bin-trash-linear" width={22} />
                  </Button>
                </div>
              ))}

              <Button
                isIconOnly
                radius="full"
                variant="light"
                onClick={handleAddNewExample}
                color="primary"
              >
                <Icon icon="solar:add-circle-linear" width={22} />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = window.innerWidth - e.clientX;
      const constrainedWidth = Math.min(Math.max(newWidth, 300), 800);
      if (constrainedWidth === width) return;
      setWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      dispatch(setSidebarWidth(width));
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, dispatch, width]);

  return (
    <Card
      className="fixed top-16 bottom-4 right-4 w-96 p-4 rounded-xl border border-solid border-default-200 overflow-auto"
    >
      {showTitleError && (
        <Alert
          className="absolute top-4 left-4 right-4 z-50"
          color="danger"
          onClose={() => setShowTitleError(false)}
        >
          Title cannot contain whitespace. Use underscores instead.
        </Alert>
      )}
      <div
        className="absolute top-0 right-0 h-full flex"
        style={{
          width: `${width}px`,
          zIndex: 2,
          userSelect: isResizing ? 'none' : 'auto'
        }}
      >
        <div
          className="absolute left-0 top-0 h-full w-1 cursor-ew-resize hover:bg-primary hover:opacity-100 opacity-0 transition-opacity"
          onMouseDown={handleMouseDown}
          style={{
            backgroundColor: isResizing ? 'var(--nextui-colors-primary)' : 'transparent',
            opacity: isResizing ? '1' : undefined
          }}
        />

        <div className="flex-1 px-6 py-1 overflow-auto max-h-screen" id="node-details">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h1 className="text-lg font-semibold">
                {node?.data?.config?.title || node?.id || 'Node Details'}
              </h1>
              <h2 className="text-xs font-semibold">{nodeType}</h2>
            </div>
            <Button
              isIconOnly
              radius="full"
              variant="light"
              onClick={() => dispatch(setSelectedNode({ nodeId: null }))}
            >
              <Icon
                className="text-default-500"
                icon="solar:close-circle-linear"
                width={24}
              />
            </Button>
          </div>

          <Accordion
            selectionMode="multiple"
            defaultExpandedKeys={hasRunOutput ? ['output'] : ['title', 'config']}
          >
            {nodeType !== 'InputNode' && (
              <AccordionItem key="output" aria-label="Output" title="Outputs">
                <NodeOutput output={node?.data?.run} />
              </AccordionItem>
            )}

            <AccordionItem key="title" aria-label="Node Title" title="Node Title">
              <Input
                value={titleInputValue}
                onChange={handleNodeTitleChange}
                placeholder="Enter node title"
                label="Node Title"
                fullWidth
                description="Use underscores instead of spaces"
              />
            </AccordionItem>

            <AccordionItem key="config" aria-label="Node Configuration" title="Node Configuration">
              {renderConfigFields()}
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </Card>
  );
};

export default NodeSidebar;
