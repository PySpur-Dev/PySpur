import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Handle, Position, useConnection, useUpdateNodeInternals } from '@xyflow/react';
import BaseNode from '../BaseNode';
import { Input, Card, Divider, Button, Select, SelectItem, RadioGroup, Radio } from '@nextui-org/react';
import { useDispatch, useSelector } from 'react-redux';
import { updateNodeData } from '../../../store/flowSlice';
import styles from '../DynamicNode.module.css';
import { Icon } from "@iconify/react";
import { RootState } from '../../../store/store';

interface Condition {
  logicalOperator?: 'AND' | 'OR';
  variable: string;
  operator: string;
  value: string;
}

interface Route {
  conditions: Condition[];
}

interface RouterNodeData {
  color?: string;
  config: {
    routes: Route[];
    input_schema?: Record<string, string>;
    output_schema?: Record<string, string>;
    title?: string;
  };
}

interface RouterNodeProps {
  id: string;
  data: RouterNodeData;
  selected?: boolean;
}

const OPERATORS = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Equals' },
  { value: 'number_equals', label: 'Number Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'not_starts_with', label: 'Does Not Start With' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
];

const DEFAULT_CONDITION: Condition = {
  variable: '',
  operator: 'contains',
  value: ''
};

const DEFAULT_ROUTE: Route = {
  conditions: [{ ...DEFAULT_CONDITION }]
};

export const RouterNode: React.FC<RouterNodeProps> = ({ id, data }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [nodeWidth, setNodeWidth] = useState<string>('auto');
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const dispatch = useDispatch();
  const nodes = useSelector((state: RootState) => state.flow.nodes);
  const edges = useSelector((state: RootState) => state.flow.edges);
  const [predecessorNodes, setPredcessorNodes] = useState(edges.filter((edge) => edge.target === id).map((edge) => {
    return nodes.find((node) => node.id === edge.source);
  }));

  // Get available input variables from the schema
  const inputVariables = Object.entries(data.config?.input_schema || {}).map(([key, type]) => ({
    value: key,
    label: `${key} (${type})`,
  }));

  // Initialize routes if they don't exist or are invalid
  useEffect(() => {
    if (!data.config?.routes || !Array.isArray(data.config.routes) || data.config.routes.length === 0) {
      handleUpdateRoutes([{ ...DEFAULT_ROUTE }]);
    } else {
      // Ensure each route has valid conditions
      const validRoutes = data.config.routes.map(route => ({
        conditions: Array.isArray(route.conditions) && route.conditions.length > 0
          ? route.conditions.map((condition, index) => ({
            ...condition,
            logicalOperator: index > 0 ? (condition.logicalOperator || 'AND') : undefined
          }))
          : [{ ...DEFAULT_CONDITION }]
      }));
      if (JSON.stringify(validRoutes) !== JSON.stringify(data.config.routes)) {
        handleUpdateRoutes(validRoutes);
      }
    }
  }, []);

  const connection = useConnection();

  useEffect(() => {
    // If a connection is in progress and the target node is this node
    // temporarily show a handle for the source node as the connection is being made
    if (connection.inProgress && connection.toNode && connection.toNode.id === id) {
      let predecessorNodes = edges
        .filter((edge) => edge.target === id)
        .map((edge) => nodes.find((node) => node.id === edge.source));

      // Check if the source node is not already included
      if (!predecessorNodes.find((node) => node?.id === connection.fromNode.id)) {
        const fromNode = nodes.find((node) => node.id === connection.fromNode.id);
        if (fromNode) {
          predecessorNodes = predecessorNodes.concat(fromNode);
        }
      }

      setPredcessorNodes(predecessorNodes);
    } else {
      // Update predecessor nodes when no connection is in progress
      const updatedPredecessorNodes = edges
        .filter((edge) => edge.target === id)
        .map((edge) => nodes.find((node) => node.id === edge.source));

      setPredcessorNodes(updatedPredecessorNodes);
    }
  }, [connection, nodes, edges, id]);

  useEffect(() => {
    if (!nodeRef.current || !data) return;
    const minNodeWidth = 400;
    const maxNodeWidth = 800;
    setNodeWidth(`${Math.min(Math.max(minNodeWidth, nodeRef.current.scrollWidth), maxNodeWidth)}px`);
  }, [data]);

  const handleUpdateRoutes = (newRoutes: Route[]) => {
    const output_schema: Record<string, string> = {};
    newRoutes.forEach((_, index) => {
      output_schema[`Route_${index + 1}`] = 'any';
    });

    const updatedData: RouterNodeData = {
      ...data,
      config: {
        ...data.config,
        routes: newRoutes,
        input_schema: data.config?.input_schema || { input: 'any' },
        output_schema
      }
    };

    dispatch(updateNodeData({
      id,
      data: updatedData
    }));
  };

  const addRoute = () => {
    const newRoute: Route = {
      conditions: [{
        variable: '',
        operator: 'contains',
        value: ''
      }]
    };

    const newRoutes: Route[] = [
      ...(data.config?.routes || []),
      newRoute
    ];

    handleUpdateRoutes(newRoutes);
  };

  const removeRoute = (index: number) => {
    const newRoutes = [...(data.config?.routes || [])];
    newRoutes.splice(index, 1);
    handleUpdateRoutes(newRoutes);
  };

  const addCondition = (routeIndex: number) => {
    const newRoutes = [...(data.config?.routes || [])].map((route, index) => {
      if (index === routeIndex) {
        return {
          ...route,
          conditions: [
            ...(route.conditions || []),
            { ...DEFAULT_CONDITION, logicalOperator: 'AND' }
          ]
        };
      }
      return route;
    });
    handleUpdateRoutes(newRoutes);
  };

  const removeCondition = (routeIndex: number, conditionIndex: number) => {
    const newRoutes = [...(data.config?.routes || [])].map((route, index) => {
      if (index === routeIndex && route.conditions?.length > 1) {
        return {
          ...route,
          conditions: route.conditions.filter((_, i) => i !== conditionIndex)
        };
      }
      return route;
    });
    handleUpdateRoutes(newRoutes);
  };

  const updateCondition = (routeIndex: number, conditionIndex: number, field: keyof Condition, value: string) => {
    const newRoutes = [...(data.config?.routes || [])].map((route, index) => {
      if (index === routeIndex) {
        return {
          ...route,
          conditions: (route.conditions || []).map((condition, i) => {
            if (i === conditionIndex) {
              const updatedValue = field === 'logicalOperator' ? (value as 'AND' | 'OR') : value;
              return { ...condition, [field]: updatedValue };
            }
            return condition;
          })
        };
      }
      return route;
    });
    handleUpdateRoutes(newRoutes as Route[]);
  };

  return (
    <BaseNode
      id={id}
      isCollapsed={isCollapsed}
      setIsCollapsed={setIsCollapsed}
      data={{
        title: data.config?.title || 'Conditional Router',
        color: data.color || '#F6AD55',
        acronym: 'IF',
        config: data.config
      }}
      style={{ width: nodeWidth }}
      className="hover:!bg-background"
    >
      <div className="p-3" ref={nodeRef}>
        {/* Input handles */}
        {predecessorNodes.map((node) => (
          <div key={node?.id} className={`${styles.handleRow} w-full justify-start mb-4`}>
            <Handle
              type="target"
              position={Position.Left}
              id={node?.data?.config?.title || node?.id}
              className={`${styles.handle} ${styles.handleLeft} ${isCollapsed ? styles.collapsedHandleInput : ''}`}
            />
            {!isCollapsed && <span className="text-sm font-medium ml-2 text-foreground">{node?.data?.config?.title || node?.id} →</span>}
          </div>
        ))}

        {!isCollapsed && (
          <>
            <Divider className="my-2" />

            {/* Expressions Header */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium text-foreground">Expressions</span>
              <Divider className="flex-grow" />
            </div>

            {/* Routes */}
            <div className="flex flex-col gap-4">
              {(data.config?.routes || []).map((route, routeIndex) => (
                <Card
                  key={routeIndex}
                  classNames={{
                    base: "bg-background border-default-200"
                  }}
                >
                  <div className="flex flex-col gap-3">
                    {/* Conditions */}
                    {(route.conditions || []).map((condition, conditionIndex) => (
                      <div key={conditionIndex} className="flex flex-col gap-2">
                        {conditionIndex > 0 && (
                          <div className="flex items-center gap-2 justify-center">
                            <RadioGroup
                              orientation="horizontal"
                              value={condition.logicalOperator}
                              onValueChange={(value) => updateCondition(routeIndex, conditionIndex, 'logicalOperator', value)}
                              size="sm"
                            >
                              <Radio value="AND">AND</Radio>
                              <Radio value="OR">OR</Radio>
                            </RadioGroup>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Select
                            size="sm"
                            value={condition.variable}
                            onChange={(e) => updateCondition(routeIndex, conditionIndex, 'variable', e.target.value)}
                            placeholder="Select variable"
                            className="flex-1"
                            classNames={{
                              trigger: "bg-default-100 dark:bg-default-50",
                              popoverContent: "bg-background dark:bg-background"
                            }}
                          >
                            {inputVariables.map((variable) => (
                              <SelectItem key={variable.value} value={variable.value}>
                                {variable.label}
                              </SelectItem>
                            ))}
                          </Select>
                          <Select
                            size="sm"
                            value={condition.operator}
                            onChange={(e) => updateCondition(routeIndex, conditionIndex, 'operator', e.target.value)}
                            className="flex-1"
                            classNames={{
                              trigger: "bg-default-100 dark:bg-default-50",
                              popoverContent: "bg-background dark:bg-background"
                            }}
                          >
                            {OPERATORS.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </Select>
                          {!['is_empty', 'is_not_empty'].includes(condition.operator) && (
                            <Input
                              size="sm"
                              value={condition.value}
                              onChange={(e) => updateCondition(routeIndex, conditionIndex, 'value', e.target.value)}
                              placeholder="Value"
                              className="flex-1"
                              classNames={{
                                input: "bg-default-100 dark:bg-default-50",
                                inputWrapper: "shadow-none"
                              }}
                            />
                          )}
                          <Button
                            size="sm"
                            color="danger"
                            isIconOnly
                            onClick={() => removeCondition(routeIndex, conditionIndex)}
                            disabled={route.conditions?.length === 1}
                          >
                            <Icon icon="solar:trash-bin-trash-linear" width={18} />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* Add Condition Button */}
                    <Button
                      size="sm"
                      variant="flat"
                      onClick={() => addCondition(routeIndex)}
                      startContent={<Icon icon="solar:add-circle-linear" width={18} />}
                      className="bg-default-100 dark:bg-default-50 hover:bg-default-200 dark:hover:bg-default-100"
                    >
                      Add Condition
                    </Button>

                    {/* Route Output Handle */}
                    <div className={`${styles.handleRow} w-full justify-end mt-2`}>
                      <div className="align-center flex flex-grow flex-shrink mr-2">
                        <span className="text-sm font-medium ml-auto text-foreground">Route_{routeIndex + 1} →</span>
                      </div>
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={`Route_${routeIndex + 1}`}
                        className={`${styles.handle} ${styles.handleRight} ${isCollapsed ? styles.collapsedHandleOutput : ''}`}
                      />
                    </div>
                  </div>
                </Card>
              ))}

              {/* Add Route Button */}
              <Button
                size="sm"
                color="primary"
                variant="flat"
                onClick={addRoute}
                startContent={<Icon icon="solar:add-circle-linear" width={18} />}
                className="bg-default-100 dark:bg-default-50 hover:bg-default-200 dark:hover:bg-default-100"
              >
                Add Route
              </Button>
            </div>
          </>
        )}

        {/* Output handles when collapsed */}
        {isCollapsed && (data.config?.routes || []).map((_, routeIndex) => (
          <div key={routeIndex} className={`${styles.handleRow} w-full justify-end mt-2`}>
            <Handle
              type="source"
              position={Position.Right}
              id={`Route_${routeIndex + 1}`}
              className={`${styles.handle} ${styles.handleRight} ${styles.collapsedHandleOutput}`}
            />
          </div>
        ))}
      </div>
    </BaseNode>
  );
};
