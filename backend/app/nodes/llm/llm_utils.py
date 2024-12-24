# type: ignore
import asyncio
import base64
import logging
import json
import re

from typing import Any, Callable, Dict, List, Optional, cast

import numpy as np
from dotenv import load_dotenv
import litellm
from litellm import acompletion
from pydantic import BaseModel, Field
from sklearn.metrics.pairwise import cosine_similarity
from tenacity import AsyncRetrying, stop_after_attempt, wait_random_exponential
from enum import Enum
from ollama import AsyncClient

# uncomment for debugging litellm issues
litellm.set_verbose = True
load_dotenv()

# Enable parameter dropping for unsupported parameters
litellm.drop_params = True

# Clean up Azure API base URL if needed
azure_api_base = os.getenv("AZURE_OPENAI_API_BASE", "").rstrip("/")
if azure_api_base.endswith("/openai"):
    azure_api_base = azure_api_base.rstrip("/openai")
os.environ["AZURE_OPENAI_API_BASE"] = azure_api_base

# If Azure OpenAi is configured, set it as the default provider
if os.getenv("AZURE_OPENAI_API_KEY"):
    litellm.api_key = os.getenv("AZURE_OPENAI_API_KEY")

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536


class LLMProvider(str, Enum):
    OPENAI = "OpenAI"
    ANTHROPIC = "Anthropic"
    GOOGLE = "Google"
    OLLAMA = "Ollama"
    AZURE_OPENAI = "AzureOpenAI"


class LLMModel(BaseModel):
    id: str
    provider: LLMProvider
    name: str


class LLMModels(str, Enum):
    # OpenAI Models
    GPT_4O_MINI = "gpt-4o-mini"
    GPT_4O = "gpt-4o"
    O1_PREVIEW = "o1-preview"
    O1_MINI = "o1-mini"
    GPT_4_TURBO = "gpt-4-turbo"
    CHATGPT_4O_LATEST = "chatgpt-4o-latest"

    # Azure OpenAI Models
    AZURE_GPT_4="azure/gpt-4"
    AZURE_GPT_4_TURBO="azure/gpt-4-turbo"
    AZURE_GPT_35_TURBO="azure/gpt-35-turbo"

    # Anthropic Models
    CLAUDE_3_5_SONNET_LATEST = "claude-3-5-sonnet-latest"
    CLAUDE_3_5_HAIKU_LATEST = "claude-3-5-haiku-latest"
    CLAUDE_3_OPUS_LATEST = "claude-3-opus-latest"

    # Google Models
    GEMINI_1_5_PRO = "gemini-1.5-pro"
    GEMINI_1_5_FLASH = "gemini-1.5-flash"
    GEMINI_1_5_PRO_LATEST = "gemini-1.5-pro-latest"
    GEMINI_1_5_FLASH_LATEST = "gemini-1.5-flash-latest"

    # Ollama Models
    OLLAMA_LLAMA3_3_8B = "ollama/llama3.3"
    OLLAMA_LLAMA3_2_8B = "ollama/llama3.2"
    OLLAMA_LLAMA3_2_1B = "ollama/llama3.2:1b"
    OLLAMA_LLAMA3_8B = "ollama/llama3"
    OLLAMA_GEMMA_2 = "ollama/gemma2"
    OLLAMA_GEMMA_2_2B = "ollama/gemma2:2b"
    OLLAMA_MISTRAL = "ollama/mistral"
    OLLAMA_CODELLAMA = "ollama/codellama"
    OLLAMA_MIXTRAL = "ollama/mixtral-8x7b-instruct-v0.1"

    @classmethod
    def get_model_info(cls, model_id: str) -> LLMModel:
        model_mapping = {
            # OpenAI Models
            cls.GPT_4O_MINI.value: LLMModel(
                id=cls.GPT_4O_MINI.value,
                provider=LLMProvider.OPENAI,
                name="GPT-4 Optimized Mini",
            ),
            cls.GPT_4O.value: LLMModel(
                id=cls.GPT_4O.value, provider=LLMProvider.OPENAI, name="GPT-4 Optimized"
            ),
            cls.O1_PREVIEW.value: LLMModel(
                id=cls.O1_PREVIEW.value, provider=LLMProvider.OPENAI, name="O1 Preview"
            ),
            cls.O1_MINI.value: LLMModel(
                id=cls.O1_MINI.value, provider=LLMProvider.OPENAI, name="O1 Mini"
            ),
            cls.GPT_4_TURBO.value: LLMModel(
                id=cls.GPT_4_TURBO.value,
                provider=LLMProvider.OPENAI,
                name="GPT-4 Turbo",
            ),
            cls.CHATGPT_4O_LATEST.value: LLMModel(
                id=cls.CHATGPT_4O_LATEST.value,
                provider=LLMProvider.OPENAI,
                name="ChatGPT-4 Optimized Latest",
            ),
            # Azure OpenAI Models
            cls.AZURE_GPT_4.value: LLMModel(
                id=cls.AZURE_GPT_4.value,
                provider=LLMProvider.AZURE_OPENAI,
                name="Azure GPT-4",
            ),
            cls.AZURE_GPT_4_TURBO.value: LLMModel(
                id=cls.AZURE_GPT_4_TURBO.value,
                provider=LLMProvider.AZURE_OPENAI,
                name="Azure GPT-4 Turbo",
            ),
            cls.AZURE_GPT_35_TURBO.value: LLMModel(
                id=cls.AZURE_GPT_35_TURBO.value,
                provider=LLMProvider.AZURE_OPENAI,
                name="Azure GPT-3.5 Turbo",
            ),
            # Anthropic Models
            cls.CLAUDE_3_5_SONNET_LATEST.value: LLMModel(
                id=cls.CLAUDE_3_5_SONNET_LATEST.value,
                provider=LLMProvider.ANTHROPIC,
                name="Claude 3.5 Sonnet Latest",
            ),
            cls.CLAUDE_3_5_HAIKU_LATEST.value: LLMModel(
                id=cls.CLAUDE_3_5_HAIKU_LATEST.value,
                provider=LLMProvider.ANTHROPIC,
                name="Claude 3.5 Haiku Latest",
            ),
            cls.CLAUDE_3_OPUS_LATEST.value: LLMModel(
                id=cls.CLAUDE_3_OPUS_LATEST.value,
                provider=LLMProvider.ANTHROPIC,
                name="Claude 3 Opus Latest",
            ),
            # Google Models
            cls.GEMINI_1_5_PRO.value: LLMModel(
                id=cls.GEMINI_1_5_PRO.value,
                provider=LLMProvider.GOOGLE,
                name="Gemini 1.5 Pro",
            ),
            cls.GEMINI_1_5_FLASH.value: LLMModel(
                id=cls.GEMINI_1_5_FLASH.value,
                provider=LLMProvider.GOOGLE,
                name="Gemini 1.5 Flash",
            ),
            cls.GEMINI_1_5_PRO_LATEST.value: LLMModel(
                id=cls.GEMINI_1_5_PRO_LATEST.value,
                provider=LLMProvider.GOOGLE,
                name="Gemini 1.5 Pro Latest",
            ),
            cls.GEMINI_1_5_FLASH_LATEST.value: LLMModel(
                id=cls.GEMINI_1_5_FLASH_LATEST.value,
                provider=LLMProvider.GOOGLE,
                name="Gemini 1.5 Flash Latest",
            ),
            # Ollama Models
            cls.OLLAMA_LLAMA3_3_8B.value: LLMModel(
                id=cls.OLLAMA_LLAMA3_3_8B.value,
                provider=LLMProvider.OLLAMA,
                name="Llama 3.3 (8B)",
            ),
            cls.OLLAMA_LLAMA3_2_8B.value: LLMModel(
                id=cls.OLLAMA_LLAMA3_2_8B.value,
                provider=LLMProvider.OLLAMA,
                name="Llama 3.2 (8B)",
            ),
            cls.OLLAMA_LLAMA3_2_1B.value: LLMModel(
                id=cls.OLLAMA_LLAMA3_2_1B.value,
                provider=LLMProvider.OLLAMA,
                name="Llama 3.2 (1B)",
            ),
            cls.OLLAMA_LLAMA3_8B.value: LLMModel(
                id=cls.OLLAMA_LLAMA3_8B.value,
                provider=LLMProvider.OLLAMA,
                name="Llama 3 (8B)",
            ),
            cls.OLLAMA_GEMMA_2.value: LLMModel(
                id=cls.OLLAMA_GEMMA_2.value, provider=LLMProvider.OLLAMA, name="Gemma 2"
            ),
            cls.OLLAMA_GEMMA_2_2B.value: LLMModel(
                id=cls.OLLAMA_GEMMA_2_2B.value,
                provider=LLMProvider.OLLAMA,
                name="Gemma 2 (2B)",
            ),
            cls.OLLAMA_MISTRAL.value: LLMModel(
                id=cls.OLLAMA_MISTRAL.value, provider=LLMProvider.OLLAMA, name="Mistral"
            ),
            cls.OLLAMA_CODELLAMA.value: LLMModel(
                id=cls.OLLAMA_CODELLAMA.value,
                provider=LLMProvider.OLLAMA,
                name="CodeLlama",
            ),
            cls.OLLAMA_MIXTRAL.value: LLMModel(
                id=cls.OLLAMA_MIXTRAL.value,
                provider=LLMProvider.OLLAMA,
                name="Mixtral 8x7B Instruct",
            ),
        }
        return model_mapping.get(model_id)


class ModelInfo(BaseModel):
    model: LLMModels = Field(
        LLMModels.GPT_4O, description="The LLM model to use for completion"
    )
    max_tokens: Optional[int] = Field(
        ...,
        ge=1,
        le=65536,
        description="Maximum number of tokens the model can generate",
    )
    temperature: Optional[float] = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Temperature for randomness, between 0.0 and 1.0",
    )
    top_p: Optional[float] = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Top-p sampling value, between 0.0 and 1.0",
    )


def create_messages(
    system_message: str,
    user_message: str,
    few_shot_examples: Optional[List[Dict[str, str]]] = None,
    history: Optional[List[Dict[str, str]]] = None,
) -> List[Dict[str, str]]:
    messages = [{"role": "system", "content": system_message}]
    if few_shot_examples:
        for example in few_shot_examples:
            messages.append({"role": "user", "content": example["input"]})
            messages.append({"role": "assistant", "content": example["output"]})
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})
    return messages


def create_messages_with_images(
    system_message: str,
    base64_image: str,
    user_message: str = "",
    few_shot_examples: Optional[List[Dict]] = None,
    history: Optional[List[Dict]] = None,
) -> List[Dict[str, str]]:
    messages = [
        {"role": "system", "content": [{"type": "text", "text": system_message}]}
    ]
    if few_shot_examples:
        for example in few_shot_examples:
            messages.append(
                {
                    "role": "user",
                    "content": [{"type": "text", "text": example["input"]}],
                }
            )
            messages.append(
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": example["img"]}}
                    ],
                }
            )
            messages.append(
                {
                    "role": "assistant",
                    "content": [{"type": "text", "text": example["output"]}],
                }
            )
    if history:
        messages.extend(history)
    messages.append(
        {
            "role": "user",
            "content": [{"type": "image_url", "image_url": {"url": base64_image}}],
        }
    )
    if user_message:
        messages[-1]["content"].append({"type": "text", "text": user_message})
    return messages


def async_retry(*dargs, **dkwargs):
    def decorator(f: Callable) -> Callable:
        r = AsyncRetrying(*dargs, **dkwargs)

        async def wrapped_f(*args, **kwargs):
            async for attempt in r:
                with attempt:
                    return await f(*args, **kwargs)

        return wrapped_f

    return decorator


@async_retry(wait=wait_random_exponential(min=30, max=120), stop=stop_after_attempt(3))
async def completion_with_backoff(**kwargs) -> str:
    try:
        model = kwargs.get("model", "")

        # Log initial request configuration
        logging.info("=== LLM Request Configuration ===")
        logging.info(f"OriginalModel: {model}")
        logging.info(f"API Base: {kwargs.get('api_base', 'Not provided')}")
        if model.startswith("azure/") or (os.getenv("AZURE_OPENAI_API_KEY")) and not model.startswith("ollama/"):
            logging.info(f"Azure API Version: {os.getenv('AZURE_OPENAI_API_VERSION', 'Not provided')}")
            logging.info(f"Azure API Deployment Name: {os.getenv('AZURE_OPENAI_DEPLOYMENT_NAME', 'Not provided')}")
            logging.info(f"Azure API Key Set: {'Yes' if os.getenv('AZURE_OPENAI_API_KEY') else 'No'}")

            # Remove the "azure/" prefix if present
            base_model = model.replace("azure/", "") if model.startswith("azure/") else model
            logging.info(f"Using Azure OpenAI for model: {base_model}")

            # Create a clean copy of kwargs without resonse_format for Azure
            azure_kwargs = kwargs.copy()
            azure_kwargs.pop("response_format", None)

            # Set up Azure-specific configuration
            azure_kwargs = {
                "model": base_model,
                "api_key": os.getenv("AZURE_OPENAI_API_KEY"),
                "api_base": os.getenv("AZURE_OPENAI_API_BASE"),
                "api_version": os.getenv("AZURE_OPENAI_API_VERSION"),
                "deployment_id": os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
            }

            # Verify all required Azure configuration is present
            required_config = ["api_key", "api_base", "api_version", "deployment_id"]
            missing_config = [key for key in required_config if not azure_kwargs.get(key)]
            if missing_config:
                raise ValueError(f"Missing Azure configuration for: {', '.join(missing_config)}")
            
            # Log the configuration (without sensitive information)
            save_config = azure_kwargs.copy()
            save_config['api_key'] = '********' if "api_key" in save_config else None
            logging.info(f"Azure Configuration: {save_config}")

            try: 
                response = await acompletion(**azure_kwargs)
                return response.choices[0].message.content
            except Exception as e:
                logging.error(f"Error calling Azure OpenAI: {e}")
                logging.error(f"Full Azure Configuration (sanitized): {save_config}")
                raise
        elif model.startswith("ollama/"):
            logging.info("=== Ollama Configuration ===")
            response = await acompletion(**kwargs)
            return response.choices[0].message.content
        else:
            logging.info("=== Standard Configuration ===")
            response = await acompletion(**kwargs)
            return response.choices[0].message.content
    except Exception as e:
        logging.error(f"=== LLM Request Error ===")
        # Create a save copy of kwargs without sensitive information
        save_config = kwargs.copy()
        save_config['api_key'] = '********' if "api_key" in save_config else None
        logging.error(f"Error occurred with configuration: {save_config}")
        logging.error(f"Error type: {type(e).__name__}")
        logging.error(f"Error message: {str(e)}")
        if hasattr(e, 'response'):
            logging.error(f"Response status: {getattr(e.response, 'status_code', 'N/A')}")
            logging.error(f"Response body: {getattr(e.response, 'text', 'N/A')}")
        raise e


@async_retry(wait=wait_random_exponential(min=30, max=300), stop=stop_after_attempt(30))
async def get_embedding(
    text: str, model: str = EMBEDDING_MODEL, dimensions: int = EMBEDDING_DIMENSIONS
) -> List[float]:
    try:
        response = await client.embeddings.create(
            input=text, model=model, dimensions=dimensions
        )
        return response.data[0].embedding
    except Exception as e:
        logging.error(e)
        raise e


async def generate_text(
    messages: List[Dict[str, str]],
    model_name: str,
    temperature: float = 0.5,
    json_mode: bool = False,
    max_tokens: int = 100000,
    api_base: Optional[str] = None,
) -> str:
    kwargs = {
        "model": model_name,
        "max_tokens": 1000,
        "messages": messages,
        "temperature": temperature,
    }

    if json_mode:
        if model_name.startswith("ollama"):
            options = OllamaOptions(temperature=temperature, max_tokens=max_tokens)
            response = await ollama_with_backoff(
                model=model_name,
                options=options,
                messages=messages,
                format="json",
                api_base=api_base,
            )
        else:
            # For both Azure and OpenAI, we need to set the response_format to json_object
            kwargs["response_format"] = {"type": "json_object"}
            # Add system message to enforce JSON mode
            messages.insert(0, {
                "role": "system", 
                "content": "You must respond with valid JSON only. No other text before or after the JSON Object."
                })
            response = await completion_with_backoff(**kwargs)

            # Verify JSON Response
            try:
                json.loads(response)
            except json.JSONDecodeError:
                logging.error(f"Response is not valid JSON: {response}")
                # Try to fix common json issues
                if not response.startswith("{"):
                    # Extract JSON if there is extra text
                    json_match = re.search(r'\{.*\}', response, re.DOTALL)
                    if json_match:
                        response = json_match.group(0)
                    else:
                        # Create a valid json response
                        response = '{' + f'"error": "Invalid response format", "original_response": "{response}"' + '}'
                raise ValueError("Response is not valid JSON")
    else:
        response = await completion_with_backoff(**kwargs)
        
    return cast(str, response)


def encode_image(image_path: str) -> str:
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


async def compute_embeddings(
    docs: List[Any],
    embedding_dimensions: int = EMBEDDING_DIMENSIONS,
    text_extractor: Optional[Callable[[Any], str]] = None,
) -> np.ndarray:
    if text_extractor:
        texts = [text_extractor(doc) for doc in docs]
    else:
        if all(isinstance(doc, str) for doc in docs):
            texts = docs
        else:
            logging.error(
                "Documents must be strings or you must provide a text_extractor function."
            )
            return np.array([])
    embeddings = []
    for text in texts:
        try:
            embedding = await get_embedding(text, dimensions=embedding_dimensions)
            embeddings.append(embedding)
        except Exception as e:
            logging.error(f"Error obtaining embedding for text: {e}")
            embeddings.append(
                [0] * embedding_dimensions
            )  # Placeholder for failed embeddings
    return np.array(embeddings)


async def find_top_k_similar(
    old_docs: List[Any],
    new_docs: List[Any],
    k: int = 5,
    text_extractor: Optional[Callable[[Any], str]] = None,
    id_extractor: Optional[Callable[[Any], Any]] = None,
) -> Dict[Any, List[Dict[str, Any]]]:
    old_embeddings = await compute_embeddings(old_docs, text_extractor=text_extractor)
    new_embeddings = await compute_embeddings(new_docs, text_extractor=text_extractor)

    similarity_matrix = cosine_similarity(old_embeddings, new_embeddings)
    top_k_indices = np.argsort(-similarity_matrix, axis=1)[:, :k]

    top_k_similar_docs = {}
    for i, old_doc in enumerate(old_docs):
        similar_docs = [
            {
                "document": new_docs[idx],
                "similarity_score": similarity_matrix[i][idx],
            }
            for idx in top_k_indices[i]
        ]
        key = id_extractor(old_doc) if id_extractor else i
        top_k_similar_docs[key] = similar_docs
    return top_k_similar_docs


class OllamaOptions(BaseModel):
    """Options for Ollama API calls"""

    temperature: float = Field(
        default=0.7, ge=0.0, le=1.0, description="Controls randomness in responses"
    )
    max_tokens: Optional[int] = Field(
        default=None, ge=0, description="Maximum number of tokens to generate"
    )
    top_p: Optional[float] = Field(
        default=None, ge=0.0, le=1.0, description="Nucleus sampling threshold"
    )
    top_k: Optional[int] = Field(
        default=None,
        ge=0,
        description="Number of tokens to consider for top-k sampling",
    )
    repeat_penalty: Optional[float] = Field(
        default=None, ge=0.0, description="Penalty for token repetition"
    )
    stop: Optional[list[str]] = Field(
        default=None, description="Stop sequences to end generation"
    )

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary, excluding None values"""
        return {k: v for k, v in self.model_dump().items() if v is not None}


@async_retry(wait=wait_random_exponential(min=30, max=120), stop=stop_after_attempt(3))
async def ollama_with_backoff(
    model: str,
    messages: list[dict[str, str]],
    format: Optional[str | dict[str, Any]] = None,
    options: Optional[OllamaOptions] = None,
    api_base: Optional[str] = None,
) -> str:
    """
    Make an async Ollama API call with exponential backoff retry logic.

    Args:
        model: The name of the Ollama model to use
        messages: List of message dictionaries with 'role' and 'content'
        response_model: Optional Pydantic model for response validation
        options: OllamaOptions instance with model parameters
        max_retries: Maximum number of retries
        initial_wait: Initial wait time between retries in seconds
        max_wait: Maximum wait time between retries in seconds

    Returns:
        Either a string response or a validated Pydantic model instance
    """
    client = AsyncClient(host=api_base)
    response = await client.chat(
        model=model.replace("ollama/", ""),
        messages=messages,
        format=format,
        options=(options or OllamaOptions()).to_dict(),
    )
    return response.message.content
