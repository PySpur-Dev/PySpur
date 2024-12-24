from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, field_validator, model_validator

from ..nodes.node_types import is_valid_node_type


class WorkflowNodeCoordinatesSchema(BaseModel):
    """
    Coordinates for a node in a workflow.
    """

    x: float
    y: float


class WorkflowNodeSchema(BaseModel):
    """
    A node represents a single step in a workflow.
    Each node receives a dictionary mapping predecessor node IDs to their outputs.
    For dynamic schema nodes, the output schema is defined in the config dictionary.
    For static schema nodes, the output schema is defined in the node class implementation.
    """

    id: str  # ID in the workflow
    title: str = ""  # Display name
    node_type: str  # Name of the node type
    config: Dict[str, Any] = (
        {}
    )  # Configuration parameters including dynamic output schema if needed
    coordinates: Optional[WorkflowNodeCoordinatesSchema] = (
        None  # Position of the node in the workflow
    )
    subworkflow: Optional["WorkflowDefinitionSchema"] = None  # Sub-workflow definition

    @model_validator(mode="after")
    def default_title_to_id(self):
        if self.title.strip() == "":
            self.title = self.id
        return self

    @field_validator("node_type")
    def type_must_be_in_factory(cls, v: str):
        if not is_valid_node_type(v):
            raise ValueError(f"Node type '{v}' is not valid.")
        return v


class WorkflowLinkSchema(BaseModel):
    """
    A link simply connects a source node to a target node.
    The target node will receive the source node's output in its input dictionary.
    """

    source_id: str
    target_id: str
    source_handle: Optional[str] = None  # The output handle from the source node
    target_handle: Optional[str] = None  # The input handle on the target node


class WorkflowDefinitionSchema(BaseModel):
    """
    A workflow is a DAG of nodes.
    """

    nodes: List[WorkflowNodeSchema]
    links: List[WorkflowLinkSchema]
    test_inputs: List[Dict[str, Any]] = []

    @field_validator("nodes")
    def nodes_must_have_unique_ids(cls, v: List[WorkflowNodeSchema]):
        node_ids = [node.id for node in v]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("Node IDs must be unique.")
        return v

    @field_validator("nodes")
    def must_have_one_and_only_one_input_node(cls, v: List[WorkflowNodeSchema]):
        input_nodes = [node for node in v if node.node_type == "InputNode"]
        if len(input_nodes) != 1:
            raise ValueError("Workflow must have exactly one input node.")
        return v

    @field_validator("nodes")
    def must_have_at_most_one_output_node(cls, v: List[WorkflowNodeSchema]):
        output_nodes = [node for node in v if node.node_type == "OutputNode"]
        if len(output_nodes) > 1:
            raise ValueError("Workflow must have at most one output node.")
        return v

    class Config:
        from_attributes = True


class WorkflowCreateRequestSchema(BaseModel):
    """
    A request to create a new workflow.
    """

    name: str
    description: str = ""
    definition: Optional[WorkflowDefinitionSchema] = None


class WorkflowResponseSchema(BaseModel):
    """
    A response containing the details of a workflow.
    """

    id: str
    name: str
    description: Optional[str]
    definition: WorkflowDefinitionSchema
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkflowVersionResponseSchema(BaseModel):
    """
    A response containing the details of a workflow version.
    """

    version: int
    name: str
    description: Optional[str]
    definition: Any
    definition_hash: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
