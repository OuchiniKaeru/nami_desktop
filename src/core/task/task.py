import asyncio
import os
import sys
import json
from pydantic import BaseModel
from agno.agent import Agent, RunResponse
from agno.tools.mcp import MultiMCPTools
from agno.run.response import RunResponseStartedEvent, RunResponseCompletedEvent, RunResponseContentEvent, ToolCallStartedEvent, ToolCallCompletedEvent, ReasoningCompletedEvent, ReasoningStartedEvent, ReasoningStepEvent
from agno.exceptions import StopAgentRun
from ..prompts.system import get_system_prompt
from ..task.setting_load import McpHub, BrowserSettings
from agno.models.google import Gemini
from agno.models.azure.openai_chat import AzureOpenAI
from agno.models.openai import OpenAIChat
from agno.storage.sqlite import SqliteStorage
from agno.memory.v2.db.sqlite import SqliteMemoryDb
from agno.memory.v2.memory import Memory, UserMemory
from agno.media import Image
from agno.tools.thinking import ThinkingTools
from agno.tools.shell import ShellTools
from agno.tools.python import PythonTools
from agno.tools.file import FileTools
from agno.knowledge.pdf import PDFKnowledgeBase, PDFReader
from ..tools import (
    bash_tool,
    read_tool,
    write_tool,
    edit_tool,
    ls_tool,
    grep_tool,
    python_repl_tool,
    pdf_read_tool,
    markitdown_tool,
    user_memory_rag,
)

tools_list = [
    ThinkingTools(),
    # ShellTools(),
    PythonTools(),
    FileTools(),
    bash_tool.execute_bash_command,
    read_tool.ReadTools(),
    write_tool.WriteTools(),
    edit_tool.EditTools(),
    ls_tool.LsTools(),
    grep_tool.GrepTools(),
    pdf_read_tool.read_pdf_tool,
    markitdown_tool.read_document_tool,
    user_memory_rag.get_user_memory_tool
]

class TaskRequest(BaseModel):
    task: str
    images: list[str] = []
    session_id: str | None = None

class Task:
    def __init__(self, session_id, task_text, mcp_hub=None, mcp_tools=None, uploaded_files=None, uploaded_images=None):
        self.session_id = session_id
        self.task_text = task_text
        self.mcp_hub = mcp_hub if mcp_hub is not None else McpHub()
        self.mcp_tools = mcp_tools
        self.uploaded_files = uploaded_files if uploaded_files is not None else []
        self.uploaded_images = uploaded_images
        self.cwd = ""
        self.stop_requested = False
        self.tools_list = tools_list
        self.system_message_content = ""
        self.agent = None
        if getattr(sys, 'frozen', False):
            # exe 実行時
            BASE_DIR = os.path.dirname(sys.executable)
        else:
            BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        self.project_dir = os.path.dirname(BASE_DIR)
        self.user_id = None
        self.user_dir = "C:/tmp"
        self.agent_storage = None  # 初期化時に設定
        self.response_stream = None

    async def get_system_message_content(self):
        # cwd を task_data 内のタスク固有のディレクトリに設定
        self.cwd = os.path.join(self.project_dir, "task_data", self.session_id)
        
        if not self.mcp_hub:
            mcp_setting_path = os.path.join(self.project_dir, ".nami", "mcp_setting.json")
            mcp_settings = {}
            if os.path.exists(mcp_setting_path):
                with open(mcp_setting_path, "r", encoding="utf-8") as f:
                    mcp_settings = json.load(f)
                self.mcp_hub = McpHub(mcp_servers=mcp_settings.get("mcpServers", {}))
            else:
                self.mcp_hub = McpHub()
            
            print(f"mcp_setting_path: {mcp_setting_path}\nDEBUG: mcp_settings: {mcp_settings}")

        browser_settings = BrowserSettings()
        
        # awaitを追加
        self.system_message_content = await get_system_prompt(
            cwd=self.cwd,
            supports_browser_use=False,
            mcp_hub=self.mcp_hub,
            browser_settings=browser_settings,
            is_next_gen_model=True,
            use_experimental_claude4_features=False
        )

        # uploaded_files の情報をシステムプロンプトに追加
        if self.uploaded_files:
            file_info = "\n\n以下のファイルがアップロードされました。これらのファイルをタスクの実行に利用できます:\n"
            for f_path in self.uploaded_files:
                file_info += f"- {f_path}\n"
            self.system_message_content += file_info
        
        user_dir_info = f"# 作業ディレクトリ\nあなたの作業ディレクトリは、{self.user_dir}です:\n"
        self.system_message_content += user_dir_info


        user_system_prompt_list = []
        for rule in self.user_rules:
            if bool(rule["disabled"]):
                pass
            else:
                rule_file_path = rule["file"]
                if not os.path.isabs(rule_file_path):
                    rule_file_path = os.path.join(self.project_dir, rule_file_path)
                with open(rule_file_path, "r", encoding="utf-8") as f:
                    data = f.read()
                user_system_prompt_list.append(data)
        
        # len() == 0 の修正も含める
        if len(user_system_prompt_list) == 0:
            pass
        else:
            user_system_prompt_list.append(self.system_message_content)
            self.system_message_content = '\n\n'.join(user_system_prompt_list)

    def load_setting(self):
        self.setting_path = os.path.join(self.project_dir, ".nami", "setting.json")
        self.db_path = os.path.join(self.project_dir, "chat_history.db")

        with open(self.setting_path, "r", encoding="utf-8") as f:
            settings = json.load(f)
        self.user_id = settings.get("user_id")
        self.user_icon = settings.get("user_icon")
        self.user_dir = settings.get("user_dir")
        self.user_rules = list(settings.get("rules"))
        self.select_model = settings.get("select_model")
        self.temperature = float(settings.get("temperature"))
        self.top_p = float(settings.get("top_p"))
        self.max_tokens = int(settings.get("max_tokens"))
        self.search_knowledge = bool(settings.get("search_knowledge"))
        self.markdown = bool(settings.get("markdown"))
        self.reasoning = bool(settings.get("reasoning"))
        self.structured_outputs = bool(settings.get("structured_outputs"))
        self.reasoning_max_steps = int(settings.get("reasoning_max_steps"))
        self.stream = bool(settings.get("stream"))
        self.show_full_reasoning = bool(settings.get("show_full_reasoning"))
        self.enable_user_memories = bool(settings.get("enable_user_memories"))
        self.enable_agentic_memory = bool(settings.get("enable_agentic_memory"))
        self.add_memory_references = bool(settings.get("add_memory_references"))
        self.agent_storage = None
        self.memory = None

    async def create_agent(self):
        if "gemini" in self.select_model:
            self.trg_model = Gemini(
                id=self.select_model,
                api_key=os.getenv("GOOGLE_API_KEY"),
                temperature=self.temperature,
                top_p=self.top_p,
                max_output_tokens=self.max_tokens
            )
        else:
            endpoint = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/"
            default_query = {"api-version": "preview"}
            model_dict = {
                "gpt-4.1-mini": "Azure-specific-name",
                "gpt-4.1": "Azure-specific-name",
                "o4-mini": "Azure-specific-name",
                "o3": "Azure-specific-name",
                "gpt-5-mini": "Azure-specific-name",
                "gpt-5": "Azure-specific-name",
            }
            trg_model = model_dict[self.select_model]
            self.trg_model = OpenAIChat(
                id=trg_model,
                api_key=os.getenv("AZURE_OPENAI_API_KEY"),
                base_url=endpoint,
                default_query=default_query,
                temperature=self.temperature,
                top_p=self.top_p,
                max_output_tokens=self.max_tokens
            )

        if self.mcp_tools is not None:
            if hasattr(self.mcp_tools, 'is_connected') and not self.mcp_tools.is_connected():
                await self.mcp_tools.connect()
        else:
            self.mcp_tools = MultiMCPTools(
                commands=self.mcp_hub.commands,
                urls=self.mcp_hub.urls,
                env=self.mcp_hub.envs,
                timeout_seconds=7200
            )
            await self.mcp_tools.connect()
        
        # SqliteStorageの初期化
        self.agent_storage = SqliteStorage(
            table_name="agent_sessions",
            db_file=self.db_path
        )
        
        self.memory = Memory(
            model=self.trg_model,
            db=SqliteMemoryDb(table_name="memories", db_file=self.db_path),
        )

        print(self.system_message_content)
        self.agent = Agent(
            model=self.trg_model,
            system_message=self.system_message_content,
            user_id=self.user_id if self.user_id else "default_user", 
            session_id=self.session_id,
            memory=self.memory,
            enable_user_memories=self.enable_user_memories,
            enable_agentic_memory=self.enable_agentic_memory,
            add_memory_references=self.add_memory_references,
            storage=self.agent_storage,
            search_knowledge=self.search_knowledge,
            markdown=self.markdown,
            reasoning=self.reasoning,
            use_json_mode=False,
            tools=self.tools_list + ([self.mcp_tools] if self.mcp_tools else []),
            reasoning_max_steps=self.reasoning_max_steps,
            add_history_to_messages=True,
            num_history_runs=25,
            stream_intermediate_steps=self.stream,
            show_tool_calls=True,
            debug_mode=True,
            telemetry=False,
        )


    async def handle_response(self, response):
        """レスポンスの型ごとの処理を関数化"""
        thought_content = None
        final_content = None

        if isinstance(response, ToolCallStartedEvent):
            thought_content = f"Tool Call: {response.tool.tool_name}"
        elif isinstance(response, ToolCallCompletedEvent):
            result = f"Tool Result: {response.tool.result}"
            if hasattr(response, 'content') and response.content and str(response.content).strip():
                result += f"\n{response.content}"
            thought_content = result
        elif isinstance(response, RunResponseCompletedEvent):
            if hasattr(response, 'content') and response.content and str(response.content).strip():
                final_content = str(response.content)
        elif isinstance(response, RunResponseContentEvent):
            if hasattr(response, 'content') and response.content and str(response.content).strip():
                thought_content = str(response.content)
        elif isinstance(response, ReasoningCompletedEvent):
            content = str(response.content)
            if content != "reasoning_steps=[]":
                thought_content = content
        elif isinstance(response, (RunResponseStartedEvent, ReasoningStartedEvent, ReasoningStepEvent)):
            pass
        elif isinstance(response, RunResponse):
            if hasattr(response, 'run_type'):
                if response.run_type in ["reasoning", "tool"]:
                    if hasattr(response, 'content') and response.content:
                        if isinstance(response.content, ReasoningCompletedEvent):
                            content = str(response.content)
                            if content != "reasoning_steps=[]":
                                thought_content = content
                        else:
                            thought_content = str(response.content)
                    else:
                        thought_content = str(response.content)
                elif response.run_type == "assistant":
                    if hasattr(response, 'content') and response.content:
                        final_content = str(response.content)
                elif response.run_type == "completed":
                    print("DEBUG: RunResponse completed, sending end event")
                    return None, None, True
            elif isinstance(response, ToolCallStartedEvent):
                thought_content = f"Tool Call: {response.tool.tool_name}"
            elif isinstance(response, ToolCallCompletedEvent):
                thought_content = f"Tool Result: {response.tool.result}"
        elif hasattr(response, 'run_type') and response.run_type == "assistant":
            if hasattr(response, 'content') and response.content:
                final_content = str(response.content)
        elif hasattr(response, 'thinking') and response.thinking:
            thought_content = str(response.thinking)
        elif hasattr(response, 'tool_summary') and response.tool_summary:
            thought_content = str(response.tool_summary)
        else:
            thought_content = f"Unhandled response type: {type(response).__name__} - {str(response)}"

        return thought_content, final_content, False

    async def initialize_and_run(self, task_text):
        """Agent初期化と実行を分離"""
        if self.agent is None:
            await self.initialize_agent()
        
        print(f"DEBUG: Starting agent.arun with task_text: {task_text[:50]}...")
        
        # 画像を処理
        if self.uploaded_images == None:
            images = None
        else:
            images=[Image(filepath=image_path) for image_path in self.uploaded_images]

        # response_streamをインスタンス変数に保存
        self.response_stream = await self.agent.arun(
            message=task_text,
            images=images,
            stream=True, 
            show_full_reasoning=True, 
            stream_intermediate_steps=True,
        )
        
        print("DEBUG: Agent.arun completed, response_stream ready")
        return self.response_stream
    
    async def process_responses(self):
        """レスポンス処理を独立した関数に"""
        if not self.response_stream:
            raise ValueError("Response stream not initialized")
        
        final_content = ""
        content_sent = False

        try:
            async for response in self.response_stream:
                if self.stop_requested:
                    yield f"event: thought\ndata: {json.dumps({'thought': 'Agent stopped by user request.'})}\n\n"
                    yield f"event: end\ndata: {json.dumps({'status': 'stopped'})}\n\n"
                    return

                print(f"DEBUG: Processing response type: {type(response).__name__}")

                thought_content, response_final_content, send_end = await self.handle_response(response)

                if thought_content:
                    yield f"event: thought\ndata: {json.dumps({'thought': thought_content})}\n\n"
                
                if response_final_content and response_final_content.strip() and not content_sent:
                    final_content = response_final_content
                    print(f"DEBUG: Sending final_content: {final_content[:100]}...")
                    yield f"event: content\ndata: {json.dumps({'content': final_content})}\n\n"
                    content_sent = True

            print("DEBUG: All responses processed")
            yield "event: end\ndata: {}\n\n"
            
            # データベース確認
            await self._check_database()
            
        except Exception as e:
            print(f"ERROR: Exception in process_responses: {e}")
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    async def _check_database(self):
        """データベース状態確認"""
        await asyncio.sleep(0.2)
        try:
            import sqlite3
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM agent_sessions WHERE session_id = ?", (self.session_id,))
            count = cursor.fetchone()[0]
            print(f"DEBUG: Found {count} records in agent_sessions for session_id: {self.session_id}")
            conn.close()
        except Exception as e:
            print(f"DEBUG: Error checking database: {e}")
            
            
    async def initialize_agent(self):
        """エージェントの初期化を行う"""
        print(f"DEBUG: Initializing agent with session_id: {self.session_id}")
        self.load_setting()
        print(f"DEBUG: Settings loaded - user_id: {self.user_id}, db_path: {self.db_path}")
        await self.get_system_message_content()
        print(f"DEBUG: System message prepared")
        await self.create_agent()
        print(f"DEBUG: Agent created successfully")

    async def cleanup(self):
        """リソースのクリーンアップ"""
        print("DEBUG: Starting cleanup...")
        if self.mcp_tools:
            try:
                await self.mcp_tools.close()
                print("DEBUG: MCP tools closed")
            except Exception as e:
                print(f"DEBUG: Error closing MCP tools: {e}")
        
        # Agentのクリーンアップ
        if self.agent:
            try:
                # もしストレージに未保存のデータがあれば保存
                if hasattr(self.agent, 'storage') and self.agent.storage:
                    print("DEBUG: Agent storage cleanup...")
                    # 必要に応じてここで明示的にセッションを保存
                    
            except Exception as e:
                print(f"DEBUG: Error in agent cleanup: {e}")
        
        print("DEBUG: Cleanup completed")
