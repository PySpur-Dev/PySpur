from abc import ABC
from typing import Dict, Any

from .base import BaseNode
from pydantic import BaseModel, create_model


class DynamicSchemaNodeConfig(BaseModel):
    """Configuration for nodes with dynamic input/output schemas."""

    input_schema: Dict[str, str]
    output_schema: Dict[str, str] = {"response": "str"}


class DynamicSchemaNode(BaseNode, ABC):
    """Base class for nodes with dynamic input/output schemas."""

    @staticmethod
    def get_model_for_schema_dict(schema: Dict[str, str], schema_name: str):
        """
        Create and return a Pydantic model based on a schema dictionary.
        """
        type_mapping = {
            "Any": Any,
            "str": str,
            "int": int,
            "float": float,
            "bool": bool,
            "any": Any,  # Handle lowercase "any" by mapping it to Any
        }

        fields = {}
        for key, value in schema.items():
            # If the type is not recognized, raise an error instead of using eval
            if value not in type_mapping:
                raise ValueError(f"Unsupported type '{value}' in schema for field '{key}'")
            fields[key] = (type_mapping[value], ...)

        return create_model(schema_name, **fields)

    def setup(self) -> None:
        """Set up dynamic input/output models based on configuration."""
        # check if the config is an instance of DynamicSchemaNodeConfig
        if not isinstance(self.config, DynamicSchemaNodeConfig):
            raise ValueError(f"Invalid configuration for {self.name}: {self.config}")
        self.input_model = self.get_model_for_schema_dict(
            schema=self.config.input_schema,
            schema_name=f"{self.name}Input",
        )

        self.output_model = self.get_model_for_schema_dict(
            schema=self.config.output_schema,
            schema_name=f"{self.name}Output",
        )


class DynamicInputFixedOutputNodeConfig(BaseModel):
    """Configuration for nodes with dynamic input schema and fixed output schema."""

    input_schema: Dict[str, str] = {"input_1": "str"}


class DynamicInputFixedOutputNode(DynamicSchemaNode):
    """Abstract base class for nodes with dynamic input schema and fixed output schema."""

    fixed_output_schema: Dict[str, str] = {}

    def setup(self) -> None:
        """Set up dynamic input model and fixed output model based on configuration."""
        if not isinstance(self.config, DynamicInputFixedOutputNodeConfig):
            raise ValueError(f"Invalid configuration for {self.name}: {self.config}")

        self.input_model = self.get_model_for_schema_dict(
            schema=self.config.input_schema,
            schema_name=f"{self.name}Input",
        )

        if not self.fixed_output_schema:
            raise ValueError(
                f"Fixed output schema must be defined in the child class for {self.name}"
            )

        self.output_model = self.get_model_for_schema_dict(
            schema=self.fixed_output_schema,
            schema_name=f"{self.name}Output",
        )


class FixedInputDynamicOutputNodeConfig(BaseModel):
    """Configuration for nodes with fixed input schema and dynamic output schema."""

    output_schema: Dict[str, str]


class FixedInputDynamicOutputNode(DynamicSchemaNode):
    """Abstract base class for nodes with fixed input schema and dynamic output schema."""

    fixed_input_schema: Dict[str, str] = {}

    def setup(self) -> None:
        """Set up fixed input model and dynamic output model based on configuration."""
        if not isinstance(self.config, FixedInputDynamicOutputNodeConfig):
            raise ValueError(f"Invalid configuration for {self.name}: {self.config}")

        if not self.fixed_input_schema:
            raise ValueError(
                f"Fixed input schema must be defined in the child class for {self.name}"
            )

        self.input_model = self.get_model_for_schema_dict(
            schema=self.fixed_input_schema,
            schema_name=f"{self.name}Input",
        )

        self.output_model = self.get_model_for_schema_dict(
            schema=self.config.output_schema,
            schema_name=f"{self.name}Output",
        )
