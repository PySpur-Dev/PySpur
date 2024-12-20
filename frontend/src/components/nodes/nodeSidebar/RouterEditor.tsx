import React from 'react';
import { Button, Input, Select, SelectItem, RadioGroup, Radio } from '@nextui-org/react';
import { Icon } from '@iconify/react';

type ComparisonOperator =
  | "contains"
  | "equals"
  | "greater_than"
  | "less_than"
  | "starts_with"
  | "not_starts_with"
  | "is_empty"
  | "is_not_empty"
  | "number_equals";

type LogicalOperator = "AND" | "OR";

interface Condition {
  variable: string;
  operator: ComparisonOperator;
  value: string;
  logicalOperator?: LogicalOperator;
}

interface RouteCondition {
  conditions: Condition[];
}

interface RouteEditorProps {
  routes: RouteCondition[];
  onChange: (routes: RouteCondition[]) => void;
  inputSchema?: Record<string, string>;
  disabled?: boolean;
}

const OPERATORS: { value: ComparisonOperator; label: string }[] = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "number_equals", label: "Number Equals" },
  { value: "greater_than", label: "Greater Than" },
  { value: "less_than", label: "Less Than" },
  { value: "starts_with", label: "Starts With" },
  { value: "not_starts_with", label: "Does Not Start With" },
  { value: "is_empty", label: "Is Empty" },
  { value: "is_not_empty", label: "Is Not Empty" },
];

const DEFAULT_CONDITION: Condition = {
  variable: '',
  operator: "contains",
  value: '',
  logicalOperator: "AND"
};

const DEFAULT_ROUTE: RouteCondition = {
  conditions: [{ ...DEFAULT_CONDITION }]
};

const RouteEditor: React.FC<RouteEditorProps> = ({
  routes = [],
  onChange,
  inputSchema = {},
  disabled = false,
}) => {
  const inputVariables = Object.entries(inputSchema).map(([key, type]) => ({
    value: key,
    label: `${key} (${type})`,
  }));

  const handleAddRoute = () => {
    onChange([...routes, { ...DEFAULT_ROUTE }]);
  };

  const handleRemoveRoute = (routeIndex: number) => {
    const newRoutes = [...routes];
    newRoutes.splice(routeIndex, 1);
    onChange(newRoutes);
  };

  const handleAddCondition = (routeIndex: number) => {
    const newRoutes = routes.map((route, index) => {
      if (index === routeIndex) {
        return {
          ...route,
          conditions: [
            ...route.conditions,
            { ...DEFAULT_CONDITION }
          ]
        };
      }
      return route;
    });
    onChange(newRoutes);
  };

  const handleRemoveCondition = (routeIndex: number, conditionIndex: number) => {
    const newRoutes = routes.map((route, index) => {
      if (index === routeIndex && route.conditions.length > 1) {
        return {
          ...route,
          conditions: route.conditions.filter((_, i) => i !== conditionIndex)
        };
      }
      return route;
    });
    onChange(newRoutes);
  };

  const handleUpdateCondition = (
    routeIndex: number,
    conditionIndex: number,
    field: keyof Condition,
    value: string
  ) => {
    const newRoutes = routes.map((route, index) => {
      if (index === routeIndex) {
        return {
          ...route,
          conditions: route.conditions.map((condition, i) => {
            if (i === conditionIndex) {
              return { ...condition, [field]: value };
            }
            return condition;
          })
        };
      }
      return route;
    });
    onChange(newRoutes);
  };

  return (
    <div className="conditionals-editor space-y-4">
      {routes.map((route, routeIndex) => (
        <div key={routeIndex} className="route-container p-4 border border-default-200 rounded-lg bg-default-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">
              {routeIndex === 0 ? "Default Route" : `Route ${routeIndex + 1}`}
            </h3>
            <div className="flex gap-2">
              <Button
                isIconOnly
                radius="full"
                variant="light"
                onClick={() => handleAddCondition(routeIndex)}
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
                onClick={() => handleRemoveRoute(routeIndex)}
                disabled={disabled || routes.length <= 1}
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
                      handleUpdateCondition(routeIndex, conditionIndex, 'logicalOperator', value as LogicalOperator)
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
                    selectedKeys={[condition.variable]}
                    onChange={(e) =>
                      handleUpdateCondition(routeIndex, conditionIndex, 'variable', e.target.value)
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
                    selectedKeys={[condition.operator]}
                    onChange={(e) =>
                      handleUpdateCondition(routeIndex, conditionIndex, 'operator', e.target.value as ComparisonOperator)
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

                  <Input
                    size="sm"
                    value={condition.value}
                    onChange={(e) =>
                      handleUpdateCondition(routeIndex, conditionIndex, 'value', e.target.value)
                    }
                    placeholder="Value"
                    className="flex-1"
                    isDisabled={disabled || ['is_empty', 'is_not_empty'].includes(condition.operator)}
                  />

                  <Button
                    isIconOnly
                    radius="full"
                    variant="light"
                    color="danger"
                    onClick={() => handleRemoveCondition(routeIndex, conditionIndex)}
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
