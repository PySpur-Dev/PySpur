from typing import Dict, Any, Optional, List, Union, Literal
from pydantic import BaseModel, Field
from enum import Enum

from ..dynamic_schema import DynamicSchemaNode, DynamicSchemaNodeConfig


class ComparisonOperator(str, Enum):
    CONTAINS = "contains"
    EQUALS = "equals"
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    STARTS_WITH = "starts_with"
    NOT_STARTS_WITH = "not_starts_with"
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"
    NUMBER_EQUALS = "number_equals"


LogicalOperator = Literal["AND", "OR"]


class Condition(BaseModel):
    """Configuration for a single condition"""
    variable: str
    operator: ComparisonOperator = Field(default=ComparisonOperator.CONTAINS)
    value: Any
    logicalOperator: Optional[LogicalOperator] = Field(default="AND")


class RouteCondition(BaseModel):
    """Configuration for a route with multiple conditions"""
    conditions: List[Condition]


class RouterNodeConfig(DynamicSchemaNodeConfig):
    """Configuration for the router node."""
    routes: List[RouteCondition]
    input_schema: Dict[str, str] = {"input_node": "Any"}  # The input data to be routed
    # output_schema will be dynamically populated in initialize()
    output_schema: Dict[str, str] = Field(default_factory=dict)


class RouterNodeInput(BaseModel):
    """Input model for the router node."""
    input_node: Dict[str, Any]  # Adjust to match the provided input structure


class RouterNode(DynamicSchemaNode):
    """
    A routing node that directs input data to different routes
    based on the evaluation of conditions. The first route acts as the default
    if no other conditions match.
    """

    name = "router_node"
    display_name = "Router"
    config_model = RouterNodeConfig

    def _evaluate_single_condition(
        self, input_value: Any, condition: Condition
    ) -> bool:
        """Evaluate a single condition against a specific input variable"""
        try:
            if not condition.variable:
                return False

            variable_value = input_value.get(condition.variable)
            if variable_value is None:
                return False

            if condition.operator == ComparisonOperator.CONTAINS:
                return str(condition.value) in str(variable_value)
            elif condition.operator == ComparisonOperator.EQUALS:
                return str(variable_value) == str(condition.value)
            elif condition.operator == ComparisonOperator.NUMBER_EQUALS:
                return float(variable_value) == float(condition.value)
            elif condition.operator == ComparisonOperator.GREATER_THAN:
                return float(variable_value) > float(condition.value)
            elif condition.operator == ComparisonOperator.LESS_THAN:
                return float(variable_value) < float(condition.value)
            elif condition.operator == ComparisonOperator.STARTS_WITH:
                return str(variable_value).startswith(str(condition.value))
            elif condition.operator == ComparisonOperator.NOT_STARTS_WITH:
                return not str(variable_value).startswith(str(condition.value))
            elif condition.operator == ComparisonOperator.IS_EMPTY:
                return not bool(variable_value)
            elif condition.operator == ComparisonOperator.IS_NOT_EMPTY:
                return bool(variable_value)
            return False
        except (ValueError, TypeError, AttributeError):
            return False

    def _evaluate_route_conditions(
        self, input_value: Dict[str, Any], route: RouteCondition
    ) -> bool:
        """Evaluate all conditions in a route with AND/OR logic"""
        if not route.conditions:
            # If no conditions, consider it always matches
            return True

        result = self._evaluate_single_condition(input_value, route.conditions[0])

        for i in range(1, len(route.conditions)):
            condition = route.conditions[i]
            current_result = self._evaluate_single_condition(input_value, condition)

            if condition.logicalOperator == "OR":
                result = result or current_result
            else:  # AND is default
                result = result and current_result

        return result

    async def run(self, input_data: RouterNodeInput) -> Dict[str, Optional[Any]]:
        """
        Evaluates conditions for each route in order. The first route that matches
        gets the input data. If no routes match, the first route acts as a default.
        """
        input_value = input_data.input_node
        route_count = len(self.config.routes)

        matched_route = None
        # Evaluate routes in order
        for i, route in enumerate(self.config.routes, start=1):
            if self._evaluate_route_conditions(input_value, route):
                matched_route = i
                break

        # If no route matched, default to first route
        if matched_route is None:
            matched_route = 1

        # Construct outputs dict
        outputs = {}
        for i in range(1, route_count + 1):
            outputs[f"Route_{i}"] = input_value if i == matched_route else None

        return outputs

    def initialize(self) -> None:
        """Initialize the node and set up the output schema"""
        # Each route corresponds to a top-level optional field in the output schema
        self.config.output_schema = {
            f"Route_{i}": "Optional[Any]" for i in range(1, len(self.config.routes) + 1)
        }
