import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Handle, Position, useConnection, useUpdateNodeInternals } from '@xyflow/react';
import BaseNode from '../BaseNode';
import { Input, Card, Divider, Button, Select, SelectItem, RadioGroup, Radio } from '@nextui-org/react';
import { useDispatch, useSelector } from 'react-redux';
import { updateNodeData } from '../../../store/flowSlice';
import styles from '../DynamicNode.module.css';
import { Icon } from "@iconify/react";
import { RootState } from '../../../store/store';
import {
  ComparisonOperator,
  LogicalOperator,
  RouteConditionRule,
  RouteConditionGroup
} from '../../../types/api_types/routerSchemas';

interface RouterNodeData {
  color?: string;
  config: {
    route_map: Record<string, RouteConditionGroup>;
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

const OPERATORS: { value: ComparisonOperator; label: string }[] = [
  { value: ComparisonOperator.CONTAINS, label: 'Contains' },
  { value: ComparisonOperator.EQUALS, label: 'Equals' },
  { value: ComparisonOperator.NUMBER_EQUALS, label: 'Number Equals' },
  { value: ComparisonOperator.GREATER_THAN, label: 'Greater Than' },
  { value: ComparisonOperator.LESS_THAN, label: 'Less Than' },
  { value: ComparisonOperator.STARTS_WITH, label: 'Starts With' },
  { value: ComparisonOperator.NOT_STARTS_WITH, label: 'Does Not Start With' },
  { value: ComparisonOperator.IS_EMPTY, label: 'Is Empty' },
  { value: ComparisonOperator.IS_NOT_EMPTY, label: 'Is Not Empty' },
];

const DEFAULT_CONDITION: RouteConditionRule = {
  variable: '',
  operator: ComparisonOperator.CONTAINS,
  value: ''
};

const DEFAULT_ROUTE: RouteConditionGroup = {
  conditions: [{ ...DEFAULT_CONDITION }],
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

  // Get available input variables from the connected node's output schema
  const inputVariables = useMemo(() => {
    const connectedNode = predecessorNodes[0];
    if (!connectedNode) return [];

    const outputSchema = connectedNode.data?.config?.output_schema || {};
    return Object.entries(outputSchema).map(([key, type]) => ({
      value: key,
      label: `${key} (${type})`,
    }));
  }, [predecessorNodes]);

  // Initialize routes if they don't exist or are invalid
  // useEffect(() => {
  //   if (!data.config?.route_map || Object.keys(data.config.route_map).length === 0) {
  //     handleUpdateRouteMap({ route1: { ...DEFAULT_ROUTE } });
  //   } else {
  //     // Ensure each route has valid conditions
  //     const validRouteMap: RouteMap = Object.entries(data.config.route_map).reduce((acc, [routeKey, route]) => {
  //       const conditions = Array.isArray(route.conditions) && route.conditions.length > 0
  //         ? route.conditions.map((condition, index): Condition => {
  //           const baseCondition: Condition = {
  //             variable: condition.variable || '',
  //             operator: (condition.operator || 'contains') as ComparisonOperator,
  //             value: condition.value || ''
  //           };

  //           if (index > 0) {
  //             baseCondition.logicalOperator = (condition.logicalOperator || 'AND') as LogicalOperator;
  //           }

  //           return baseCondition;
  //         })
  //         : [{ ...DEFAULT_CONDITION }];
  //       acc[routeKey] = { conditions };
  //       return acc;
  //     }, {} as RouteMap);

  //     if (JSON.stringify(validRouteMap) !== JSON.stringify(data.config.route_map)) {
  //       handleUpdateRouteMap(validRouteMap);
  //     }
  //   }
  // }, [data.config.route_map]);

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

  const handleUpdateRouteMap = (newRouteMap: Record<string, RouteConditionGroup>) => {
    const output_schema: Record<string, string> = {};
    Object.keys(newRouteMap).forEach((routeKey) => {
      output_schema[routeKey] = 'any';
    });

    const updatedData: RouterNodeData = {
      ...data,
      config: {
        ...data.config,
        route_map: newRouteMap,
        input_schema: data.config?.input_schema,
        output_schema,
      },
    };

    dispatch(updateNodeData({ id, data: updatedData }));
  };

  const addRoute = () => {
    const newRouteKey = `route${Object.keys(data.config?.route_map || {}).length + 1}`;
    const newRouteMap = {
      ...data.config.route_map,
      [newRouteKey]: { ...DEFAULT_ROUTE },
    };
    handleUpdateRouteMap(newRouteMap);
  };

  const removeRoute = (routeKey: string) => {
    const { [routeKey]: _, ...newRouteMap } = data.config.route_map || {};
    handleUpdateRouteMap(newRouteMap);
  };

  const addCondition = (routeKey: string) => {
    const newRouteMap = {
      ...data.config.route_map,
      [routeKey]: {
        conditions: [
          ...data.config.route_map[routeKey].conditions,
          { ...DEFAULT_CONDITION, logicalOperator: 'AND' as const },
        ],
      },
    };
    handleUpdateRouteMap(newRouteMap);
  };

  const removeCondition = (routeKey: string, conditionIndex: number) => {
    const newRouteMap = {
      ...data.config.route_map,
      [routeKey]: {
        conditions: data.config.route_map[routeKey].conditions.filter(
          (_, i) => i !== conditionIndex
        ),
      },
    };
    handleUpdateRouteMap(newRouteMap);
  };

  const updateCondition = (
    routeKey: string,
    conditionIndex: number,
    field: keyof RouteConditionRule,
    value: string
  ) => {
    const newRouteMap = {
      ...data.config.route_map,
      [routeKey]: {
        conditions: data.config.route_map[routeKey].conditions.map((condition, i) =>
          i === conditionIndex ? { ...condition, [field]: value } : condition
        ),
      },
    };
    handleUpdateRouteMap(newRouteMap);
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
              {Object.entries(data.config.route_map || {}).map(([routeKey, route]) => (
                console.log(route),
                <Card key={routeKey} classNames={{ base: 'bg-background border-default-200' }}>
                  <div className="flex flex-col gap-3">
                    {/* Conditions */}
                    {(route.conditions || []).map((condition, conditionIndex) => (
                      console.log(condition),
                      <div key={conditionIndex} className="flex flex-col gap-2">
                        {conditionIndex > 0 && (
                          <div className="flex items-center gap-2 justify-center">
                            <RadioGroup
                              orientation="horizontal"
                              value={condition.logicalOperator}
                              onValueChange={(value) =>
                                updateCondition(routeKey, conditionIndex, 'logicalOperator', value)
                              }
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
                            onChange={(e) =>
                              updateCondition(routeKey, conditionIndex, 'variable', e.target.value)
                            }
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
                            onChange={(e) => updateCondition(routeKey, conditionIndex, 'operator', e.target.value)}
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
                              onChange={(e) =>
                                updateCondition(routeKey, conditionIndex, 'value', e.target.value)
                              }
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
                            onClick={() => removeCondition(routeKey, conditionIndex)}
                            disabled={route.conditions.length === 1}
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
                      onClick={() => addCondition(routeKey)}
                      startContent={<Icon icon="solar:add-circle-linear" width={18} />}
                      className="bg-default-100 dark:bg-default-50 hover:bg-default-200 dark:hover:bg-default-100"
                    >
                      Add Condition
                    </Button>

                    {/* Route Output Handle */}
                    <div className={`${styles.handleRow} w-full justify-end mt-2`}>
                      <div className="align-center flex flex-grow flex-shrink mr-2">
                        <span className="text-sm font-medium ml-auto text-foreground">{routeKey} →</span>
                      </div>
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={routeKey}
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
        {isCollapsed && Object.keys(data.config?.route_map || {}).map((routeKey) => (
          <div key={routeKey} className={`${styles.handleRow} w-full justify-end mt-2`}>
            <Handle
              type="source"
              position={Position.Right}
              id={routeKey}
              className={`${styles.handle} ${styles.handleRight} ${styles.collapsedHandleOutput}`}
            />
          </div>
        ))}
      </div>
    </BaseNode>
  );
};
