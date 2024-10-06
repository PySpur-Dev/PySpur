import json
from re import A, S, T
from typing import Any, Dict
from venv import create
from attr import validate
from click import INT

from regex import D, E
from .llm_utils import create_messages, generate_text
from .base import BaseNodeType
from pydantic import BaseModel, create_model
from enum import Enum


class ModelName(str, Enum):
    GPT_4O_MINI = "gpt-4o-mini"
    GPT_4O = "gpt-4o"
    O1_PREVIEW = "o1-preview"
    O1_MINI = "o1-mini"
    GPT_4_TURBO = "gpt-4-turbo"


class BasicLLMNodeConfig(BaseModel):
    llm_name: ModelName
    max_tokens: int
    temperature: float
    json_mode: bool
    system_prompt: str


class BasicLLMNodeInput(BaseModel):
    user_message: str


class BasicLLMNodeOutput(BaseModel):
    assistant_message: str


class BasicLLMNodeType(
    BaseNodeType[BasicLLMNodeConfig, BasicLLMNodeInput, BasicLLMNodeOutput]
):
    """
    Basic node type for calling an LLM.
    """

    name = "basic_llm_node"

    def __init__(self, config: BasicLLMNodeConfig) -> None:
        self.config = config

    async def __call__(self, input_data: BasicLLMNodeInput) -> BasicLLMNodeOutput:
        messages = create_messages(
            system_message=self.config.system_prompt,
            user_message=input_data.user_message,
        )
        assistant_message = await generate_text(
            messages=messages,
            model_name=self.config.llm_name,
            temperature=self.config.temperature,
            json_mode=self.config.json_mode,
        )
        return BasicLLMNodeOutput(assistant_message=assistant_message)


class LLMStructuredOutputValueType(str, Enum):
    INT = "int"
    FLOAT = "float"
    STR = "str"
    BOOL = "bool"


class StructuredOutputLLMNodeConfig(BaseModel):
    llm_name: ModelName
    max_tokens: int
    temperature: float
    system_prompt: str
    output_schema: Dict[str, LLMStructuredOutputValueType]  # output keys and types


class StructuredOutputLLMNodeInput(BaseModel):
    user_message: str


class StructuredOutputLLMNodeOutput(BaseModel):
    pass


class StructuredOutputLLMNodeType(
    BaseNodeType[
        StructuredOutputLLMNodeConfig,
        StructuredOutputLLMNodeInput,
        StructuredOutputLLMNodeOutput,
    ]
):
    """
    Node type for calling an LLM with structured output.
    """

    name = "structured_output_llm_node"

    def _get_python_type(self, value_type: LLMStructuredOutputValueType) -> Any:
        if value_type == LLMStructuredOutputValueType.INT:
            return int
        elif value_type == LLMStructuredOutputValueType.FLOAT:
            return float
        elif value_type == LLMStructuredOutputValueType.STR:
            return str
        elif value_type == LLMStructuredOutputValueType.BOOL:
            return bool
        else:
            raise ValueError(f"Invalid value type: {value_type}")

    def __init__(self, config: StructuredOutputLLMNodeConfig) -> None:
        self.config = StructuredOutputLLMNodeConfig.model_validate(config.model_dump())
        output_schema = config.output_schema
        print("output_schema", output_schema)
        output_schema = {k: self._get_python_type(v) for k, v in output_schema.items()}
        print("output_schema", output_schema)
        output_schema = {k: (v, ...) for k, v in output_schema.items()}
        print("output_schema", output_schema)
        self.output_model = create_model(  # type: ignore
            "StructuredOutputLLMNodeOutput",
            **output_schema,  # type: ignore
            __base__=StructuredOutputLLMNodeOutput,
        )

    async def __call__(
        self, input_data: StructuredOutputLLMNodeInput
    ) -> StructuredOutputLLMNodeOutput:
        messages = create_messages(
            system_message=self.config.system_prompt,
            user_message=input_data.user_message,
        )
        print("config", self.config.model_json_schema())
        assistant_message = await generate_text(
            messages=messages,
            model_name=self.config.llm_name,
            temperature=self.config.temperature,
            json_mode=True,
        )
        assistant_message = json.loads(assistant_message)
        assistant_message = self.output_model(**assistant_message)
        return assistant_message
