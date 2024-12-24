import React, { useMemo } from 'react';
import { Button, Input, Select, SelectItem, RadioGroup, Radio } from '@nextui-org/react';
import { Icon } from '@iconify/react';

type ComparisonOperator =
  | 'contains'
  | 'equals'
  | 'greater_than'
  | 'less_than'
  | 'starts_with'
  | 'not_starts_with'
  | 'is_empty'
  | 'is_not_empty'
  | 'number_equals';

type LogicalOperator = 'AND' | 'OR';

interface Condition {
  variable: string;
  operator: ComparisonOperator;
  value: string;
  logicalOperator?: LogicalOperator;
}

interface RouteMap {
  [key: string]: {
    conditions: Condition[];
  };
}

interface RouteEditorProps {
  routeMap: RouteMap;
  onChange: (routeMap: RouteMap) => void;
  inputSchema?: Record<string, string>;
  disabled?: boolean;
}

const OPERATORS: { value: ComparisonOperator; label: string }[] = [
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
  value: '',
  logicalOperator: 'AND',
};

const DEFAULT_ROUTE = {
  conditions: [{ ...DEFAULT_CONDITION }],
};

const RouteEditor: React.FC<RouteEditorProps> = ({
  routeMap = {},
  onChange,
  inputSchema = {},
  disabled = false,
}) => {
  // Generate a list of available input variables based on the schema
  const inputVariables = useMemo(() => {
    return Object.entries(inputSchema).map(([key, type]) => ({
      value: key,
      label: `${key} (${type})`,
    }));
  }, [inputSchema]);

  const handleAddRoute = () => {
    const newRouteKey = `route${Object.keys(routeMap).length + 1}`;
    onChange({ ...routeMap, [newRouteKey]: { ...DEFAULT_ROUTE } });
  };

  const handleRemoveRoute = (routeKey: string) => {
    const { [routeKey]: _, ...updatedRouteMap } = routeMap;
    onChange(updatedRouteMap);
  };

  const handleAddCondition = (routeKey: string) => {
    const updatedRouteMap = {
      ...routeMap,
      [routeKey]: {
        conditions: [...routeMap[routeKey].conditions, { ...DEFAULT_CONDITION }],
      },
    };
    onChange(updatedRouteMap);
  };

  const handleRemoveCondition = (routeKey: string, conditionIndex: number) => {
    const updatedRouteMap = {
      ...routeMap,
      [routeKey]: {
        conditions: routeMap[routeKey].conditions.filter((_, i) => i !== conditionIndex),
      },
    };
    onChange(updatedRouteMap);
  };

  const handleUpdateCondition = (
    routeKey: string,
    conditionIndex: number,
    field: keyof Condition,
    value: string
  ) => {
    const updatedRouteMap = {
      ...routeMap,
      [routeKey]: {
        conditions: routeMap[routeKey].conditions.map((condition, i) =>
          i === conditionIndex ? { ...condition, [field]: value } : condition
        ),
      },
    };
    onChange(updatedRouteMap);
  };

  return (
    <div className="conditionals-editor space-y-4">
      {Object.entries(routeMap).map(([routeKey, route]) => (
        <div key={routeKey} className="route-container p-4 border border-default-200 rounded-lg bg-default-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">
              {routeKey === 'route1' ? 'Default Route' : routeKey}
            </h3>
            <div className="flex gap-2">
              <Button
                isIconOnly
                radius="full"
                variant="light"
                onClick={() => handleAddCondition(routeKey)}
                disabled={disabled}
                size="sm"
              >
                <Icon icon="solar:add-circle-linear" width={20} />
              </Button>
              <Button
                isIconOnly
                radius="full"
                variant="light"
                color="danger"
                onClick={() => handleRemoveRoute(routeKey)}
                disabled={disabled || Object.keys(routeMap).length <= 1}
                size="sm"
              >
                <Icon icon="solar:trash-bin-trash-linear" width={20} />
              </Button>
            </div>
          </div>

          <div className="conditions-container space-y-4">
            {route.conditions.map((condition, conditionIndex) => (
              <div key={conditionIndex} className="condition-row space-y-2">
                {conditionIndex > 0 && (
                  <RadioGroup
                    orientation="horizontal"
                    value={condition.logicalOperator}
                    onValueChange={(value) =>
                      handleUpdateCondition(routeKey, conditionIndex, 'logicalOperator', value as LogicalOperator)
                    }
                    size="sm"
                    className="justify-center"
                    isDisabled={disabled}
                  >
                    <Radio value="AND">AND</Radio>
                    <Radio value="OR">OR</Radio>
                  </RadioGroup>
                )}

                <div className="flex gap-2 items-center">
                  <Select
                    size="sm"
                    value={condition.variable}
                    onChange={(e) =>
                      handleUpdateCondition(routeKey, conditionIndex, 'variable', e.target.value)
                    }
                    placeholder="Select variable"
                    className="flex-1"
                    isDisabled={disabled}
                  >
                    {inputVariables.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </Select>

                  <Select
                    size="sm"
                    value={condition.operator}
                    onChange={(e) =>
                      handleUpdateCondition(routeKey, conditionIndex, 'operator', e.target.value as ComparisonOperator)
                    }
                    placeholder="Select operator"
                    className="flex-1"
                    isDisabled={disabled}
                  >
                    {OPERATORS.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </Select>

                  {!['is_empty', 'is_not_empty'].includes(condition.operator) && (
                    <Input
                      size="sm"
                      value={condition.value}
                      onChange={(e) =>
                        handleUpdateCondition(routeKey, conditionIndex, 'value', e.target.value)
                      }
                      placeholder="Value"
                      className="flex-1"
                      isDisabled={disabled}
                    />
                  )}

                  <Button
                    isIconOnly
                    radius="full"
                    variant="light"
                    color="danger"
                    onClick={() => handleRemoveCondition(routeKey, conditionIndex)}
                    disabled={disabled || route.conditions.length <= 1}
                    size="sm"
                  >
                    <Icon icon="solar:trash-bin-trash-linear" width={20} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Button
        variant="flat"
        color="primary"
        onClick={handleAddRoute}
        disabled={disabled}
        startContent={<Icon icon="solar:add-circle-linear" width={20} />}
        className="w-full"
      >
        Add Route
      </Button>
    </div>
  );
};

export default RouteEditor;
