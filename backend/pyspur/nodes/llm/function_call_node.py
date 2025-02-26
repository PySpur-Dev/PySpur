import json
from typing import Dict, List, Optional, Any, Callable
from pydantic import BaseModel, Field

from ._utils import (
    ModelInfo,
    LLMModels,
    create_messages,
    generate_text,
)
from ..base import (
    BaseNode,
    BaseNodeConfig,
    BaseNodeInput,
    BaseNodeOutput,
)


class FunctionDefinition(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any]
    python_function: Optional[Callable[..., Any]] = None

class LLMFunctionCallConfig(BaseNodeConfig):
    llm_info: ModelInfo = Field(
        ModelInfo(model=LLMModels.GPT_4O, max_tokens=16384, temperature=0.7),
        description="The LLM model configuration",
    )
    system_message: str = Field(
        "You are a helpful assistant that can call functions.",
        description="The system message for the LLM",
    )
    user_message: str = Field(
        "",
        description="Template for the user message",
    )
    functions: List[FunctionDefinition] = Field(
        default_factory=list,
        description="List of available functions",
    )
    function_call: str = Field(
        "auto",
        description="How to handle function calling: 'auto', 'none', or specific function name",
    )

class LLMFunctionCallInput(BaseNodeInput):
    user_request: str = Field(description="The user's request to process")

    class Config:
        extra = "allow"

class FunctionCall(BaseModel):
    name: str = Field(..., description="Name of the function called")
    arguments: Dict[str, Any] = Field(..., description="Arguments passed to the function")
    result: Any = Field(..., description="Result returned by the function")

class LLMFunctionCallOutput(BaseNodeOutput):
    result: Dict[str, Any] = Field(description="The final result after function execution")
    function_calls: List[FunctionCall] = Field(
        default_factory=list,
        description="List of executed function calls",
    )

class LLMFunctionCallNode(BaseNode):
    """
    Node for making LLM calls with function calling capabilities.
    Supports registering Python functions and handling their execution.
    """

    name = "llm_function_call_node"
    display_name = "LLM Function Call"
    config_model = LLMFunctionCallConfig
    input_model = LLMFunctionCallInput
    output_model = LLMFunctionCallOutput

    def __init__(self, name: str, config: LLMFunctionCallConfig, **kwargs: Any):
        super().__init__(name=name, config=config, **kwargs)
        self._function_registry: Dict[str, Callable[..., Any]] = {}

    def register_function(self, func: Callable[..., Any], description: str, parameters: Dict[str, Any]) -> None:
        """Register a Python function for LLM to call"""
        function_def = FunctionDefinition(
            name=func.__name__,
            description=description,
            parameters=parameters,
            python_function=func
        )
        self.config.functions.append(function_def)
        self._function_registry[func.__name__] = func

    def _prepare_functions_for_litellm(self) -> List[Dict[str, Any]]:
        """Convert function definitions to litellm format"""
        return [
            {
                "name": f.name,
                "description": f.description,
                "parameters": f.parameters
            }
            for f in self.config.functions
        ]

    async def _execute_function(self, name: str, arguments: Dict[str, Any]) -> Any:
        """Execute a registered function with given arguments, with error handling."""
        if name not in self._function_registry:
            raise ValueError(f"Function {name} not found in registry")

        func = self._function_registry[name]
        try:
            return await func(**arguments) if hasattr(func, "__await__") else func(**arguments)
        except Exception as e:
            raise RuntimeError(f"Error executing function {name}: {str(e)}")

    async def run(self, input: BaseModel) -> BaseNodeOutput:
        try:
            # Prepare input data
            raw_input_dict = input.model_dump()

            # Render messages
            system_message = self.config.system_message
            user_message = (
                json.dumps(raw_input_dict, indent=2)
                if not self.config.user_message.strip()
                else self.config.user_message.format(**raw_input_dict)
            )

            messages = create_messages(
                system_message=system_message,
                user_message=user_message,
            )

            # Prepare function definitions for litellm
            functions = self._prepare_functions_for_litellm()

            # Make initial LLM call
            response = await generate_text(
                messages=messages,
                model_name=self.config.llm_info.model.value,
                temperature=self.config.llm_info.temperature,
                max_tokens=self.config.llm_info.max_tokens,
                functions=functions,
                function_call=self.config.function_call
            )

            # Parse response and handle function calls
            try:
                response_data = json.loads(response)
            except json.JSONDecodeError:
                raise ValueError("Invalid JSON response from LLM")

            executed_functions: List[FunctionCall] = []

            if "function_call" in response_data:
                function_call = response_data["function_call"]
                function_name: str = function_call.get("name", "")
                function_args: Dict[str, Any] = function_call.get("arguments", {})

                if not function_name:
                    raise ValueError("Function call response missing 'name' field")

                try:
                    result: Any = await self._execute_function(function_name, function_args)
                except Exception as e:
                    raise RuntimeError(f"Error executing function {function_name}: {str(e)}")

                # Record the function call
                executed_functions.append(FunctionCall(
                    name=str(function_name),
                    arguments=dict(function_args),
                    result=result
                ))

                # Add function result to messages and make another LLM call
                messages.append({
                    "role": "function",
                    "name": function_name,
                    "content": json.dumps(result)
                })

                final_response = await generate_text(
                    messages=messages,
                    model_name=self.config.llm_info.model.value,
                    temperature=self.config.llm_info.temperature,
                    max_tokens=self.config.llm_info.max_tokens
                )

                return LLMFunctionCallOutput(
                    result=json.loads(final_response),
                    function_calls=executed_functions
                )

            # If no function was called, return the direct response
            return LLMFunctionCallOutput(
                result=response_data,
                function_calls=executed_functions
            )
        except Exception as e:
            raise RuntimeError(f"Error in LLMFunctionCallNode run method: {str(e)}")

if __name__ == "__main__":
    import asyncio
    import datetime
    from typing import Dict, List, Any, Optional

    # Example functions that could be registered
    async def get_weather(location: str, unit: str = "celsius") -> Dict[str, Any]:
        """Mock weather function"""
        return {"temperature": 22, "unit": unit, "location": location}

    def search_database(query: str, limit: Optional[int] = 10) -> List[Dict[str, Any]]:
        """Mock database search function"""
        return [
            {"id": 1, "title": f"Result for {query} #{i}"}
            for i in range(min(3, limit or 10))
        ]

    async def create_calendar_event(
        title: str,
        start_time: str,
        duration_minutes: int = 60,
        attendees: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Mock calendar event creation"""
        return {
            "event_id": "evt_123",
            "title": title,
            "start": start_time,
            "duration": duration_minutes,
            "attendees": attendees or [],
            "created_at": datetime.datetime.now().isoformat()
        }

    async def test_function_call_node():
        # Create node instance with multiple functions
        node = LLMFunctionCallNode(
            name="personal_assistant",
            config=LLMFunctionCallConfig(
                llm_info=ModelInfo(
                    model=LLMModels.GPT_4O,
                    max_tokens=1000,
                    temperature=0.7
                ),
                system_message=(
                    "You are a helpful personal assistant that can check weather, "
                    "search information, and manage calendar events. "
                    "Use the available functions to help the user."
                ),
                user_message="{user_request}",
                function_call="auto"
            )
        )

        # Register weather function
        node.register_function(
            func=get_weather,
            description="Get the current weather in a location",
            parameters={
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City name"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "Temperature unit"
                    }
                },
                "required": ["location"]
            }
        )

        # Register database search function
        node.register_function(
            func=search_database,
            description="Search the database for information",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query string"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results to return",
                        "minimum": 1,
                        "maximum": 50
                    }
                },
                "required": ["query"]
            }
        )

        # Register calendar function
        node.register_function(
            func=create_calendar_event,
            description="Create a new calendar event",
            parameters={
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Title of the event"
                    },
                    "start_time": {
                        "type": "string",
                        "description": "Start time in ISO format"
                    },
                    "duration_minutes": {
                        "type": "integer",
                        "description": "Duration in minutes",
                        "minimum": 15,
                        "maximum": 480
                    },
                    "attendees": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of attendee email addresses"
                    }
                },
                "required": ["title", "start_time"]
            }
        )

        # Test cases
        test_cases = [
            {
                "name": "Weather Query",
                "request": "What's the weather like in Tokyo and London?"
            },
            {
                "name": "Search Query",
                "request": "Find me information about machine learning"
            },
            {
                "name": "Calendar Event",
                "request": "Schedule a team meeting tomorrow at 2pm for 45 minutes with bob@example.com and alice@example.com"
            },
            {
                "name": "Mixed Query",
                "request": "Check the weather in Paris and schedule a picnic if it's nice"
            }
        ]

        # Run test cases
        for test in test_cases:
            print(f"\n=== Testing: {test['name']} ===")
            print(f"Request: {test['request']}")

            try:
                result = await node(LLMFunctionCallInput(user_request=test['request']))
                print("\nResult:")
                print(f"- Final output: {result.result}")
                print("\nFunction calls made:")
                for call in result.function_calls:
                    print(f"- Called: {call.name}")
                    print(f"  Args: {call.arguments}")
                    print(f"  Result: {call.result}")
            except Exception as e:
                print(f"Error: {str(e)}")

    # Run the test
    asyncio.run(test_function_call_node())