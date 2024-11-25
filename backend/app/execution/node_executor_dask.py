from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from ..nodes.base import BaseNode
from ..nodes.factory import NodeFactory
from ..schemas.workflow_schemas import WorkflowLinkSchema, WorkflowNodeSchema


class NodeExecutorDask:
    """
    Handles the execution of a workflow node using Dask.
    """

    def __init__(self, workflow_node: WorkflowNodeSchema):
        self.workflow_node = workflow_node
        self._node_instance: Optional[BaseNode] = None

    def create_node_instance(self) -> BaseNode:
        """
        Instantiate the node type with the provided configuration.
        """
        node_type_name = self.workflow_node.node_type
        config = self.workflow_node.config
        return NodeFactory.create_node(node_type_name, config)

    @property
    def node_instance(self) -> BaseNode:
        if self._node_instance is None:
            self._node_instance = self.create_node_instance()
        return self._node_instance

    async def execute_with_dependencies(
        self,
        dependency_outputs: List[tuple[str, BaseModel]],
        links: List[WorkflowLinkSchema],
        node_dict: Dict[str, WorkflowNodeSchema],
        initial_input: Dict[str, Any],
    ) -> BaseModel:
        """
        Execute the node after resolving dependencies.
        """
        # Prepare input data
        input_data = initial_input.copy()

        # Map outputs from dependencies to inputs based on links
        for link in links:
            if link.target_id == self.workflow_node.id:
                for dep_id, dep_output in dependency_outputs:
                    if dep_output and dep_id == link.source_id:
                        source_value = getattr(dep_output, link.source_output_key)
                        input_data[link.target_input_key] = source_value
                        break

        # Instantiate input data
        node_input_data = self.node_instance.input_model.model_validate(input_data)

        # Execute node
        output = await self(node_input_data)
        return output

    async def __call__(self, input_data: BaseModel | Dict[str, Any]) -> BaseModel:
        """
        Execute the node with the given input data.
        """
        if isinstance(input_data, dict):
            input_data = self.node_instance.input_model.model_validate(input_data)
        return await self.node_instance(input_data)
