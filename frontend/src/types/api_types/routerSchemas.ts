export enum ComparisonOperator {
  CONTAINS = "contains",
  EQUALS = "equals", 
  GREATER_THAN = "greater_than",
  LESS_THAN = "less_than",
  STARTS_WITH = "starts_with",
  NOT_STARTS_WITH = "not_starts_with",
  IS_EMPTY = "is_empty",
  IS_NOT_EMPTY = "is_not_empty",
  NUMBER_EQUALS = "number_equals"
}

export type LogicalOperator = "AND" | "OR";

export interface RouteConditionRule {
  variable: string;
  operator: ComparisonOperator;
  value: any;
  logicalOperator?: LogicalOperator;
}

export interface RouteConditionGroup {
  conditions: RouteConditionRule[];
}
