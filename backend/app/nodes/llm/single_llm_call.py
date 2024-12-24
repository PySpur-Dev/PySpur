import json
import os
from dotenv import load_dotenv
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from ..base import (
    VariableOutputBaseNode,
    VariableOutputBaseNodeConfig,
    BaseNodeInput,
    BaseNodeOutput,
)
from .llm_utils import LLMModels, ModelInfo, create_messages, generate_text
from jinja2 import Template

load_dotenv()

class SingleLLMCallNodeConfig(VariableOutputBaseNodeConfig):
    llm_info: ModelInfo = Field(
        ModelInfo(model=LLMModels.GPT_4O, max_tokens=16384, temperature=0.7),
        description="The default LLM model to use",
    )
    system_message: str = Field(
        "You are a helpful assistant.", description="The system message for the LLM"
    )
    user_message: str = Field(
        "",
        description="The user message for the LLM, serialized from input_schema",
    )
    few_shot_examples: Optional[List[Dict[str, str]]] = None


class SingleLLMCallNodeInput(BaseNodeInput):
    """
    We allow any/all extra fields, so that the entire dictionary passed in 
    is available in `input.model_dump()`.
    """
    class Config:
        extra = "allow"


class SingleLLMCallNodeOutput(BaseNodeOutput):
    pass


class SingleLLMCallNode(VariableOutputBaseNode):
    """
    Node type for calling an LLM with structured i/o and support for params in system prompt and user_input.
    """

    name = "single_llm_call_node"
    display_name = "Single LLM Call"
    config_model = SingleLLMCallNodeConfig
    input_model = SingleLLMCallNodeInput
    output_model = SingleLLMCallNodeOutput

    def setup(self) -> None:
        print("[DEBUG] Setting up SingleLLMCallNode with config:", self.config)
        return super().setup()

    async def run(self, input: BaseModel) -> BaseModel:
        # Grab the entire dictionary from the input
        raw_input_dict = input.model_dump()
        print("[DEBUG] Full raw_input_dict in SingleLLMCallNode:", raw_input_dict)

        # Render system_message
        system_message = Template(self.config.system_message).render(raw_input_dict) 
        system_message += (
            f"\nMake sure the output is a JSON Object like this: {self.config.output_schema}"
        )

        # If user_message is empty, dump the entire raw dictionary
        if not self.config.user_message.strip():
            user_message = json.dumps(raw_input_dict, indent=2)
        else:
            user_message = Template(self.config.user_message).render(**raw_input_dict)

        messages = create_messages(
            system_message=system_message,
            user_message=user_message,
            few_shot_examples=self.config.few_shot_examples,
        )

        kwargs = {
            "messages": messages,
            "model_name": LLMModels(self.config.llm_info.model).value,
            "temperature": self.config.llm_info.temperature,
            "json_mode": True,
        }

        assistant_message_str = await generate_text(**kwargs)
        assistant_message_dict = json.loads(assistant_message_str)

        # Validate and return
        assistant_message = self.output_model.model_validate(assistant_message_dict)
        return assistant_message



if __name__ == "__main__":
    from pydantic import create_model
    import asyncio

    async def test_llm_nodes():
        # Example 1: Simple test case with a basic user message
        simple_llm_node = SingleLLMCallNode(
            name="WeatherBot",
            config=SingleLLMCallNodeConfig(
                llm_info=ModelInfo(
                    model=LLMModels.GPT_4O, temperature=0.1, max_tokens=100
                ),
                system_message="This is a simple test prompt for {{ Input.your_name }}.",
                user_message="Hello, my name is {{ Input.your_name }}. I want to ask: {{ Input.user_message }}",
                output_schema={"response": "str", "what_was_my_name_again?": "str"},
            ),
        )

        simple_input = create_model(
            "SimpleInput",
            your_name=(str, ...),
            user_message=(str, ...),
            __base__=BaseNodeOutput,
        ).model_validate(
            {"your_name": "Alice", "user_message": "What is the weather like today?"}
        )

        print("[DEBUG] Testing simple_llm_node now...")
        simple_output = await simple_llm_node({"Input": simple_input})
        print("[DEBUG] Test Output from single_llm_call:", simple_output)

    asyncio.run(test_llm_nodes())
