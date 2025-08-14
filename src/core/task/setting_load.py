from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class McpSettingsUpdate(BaseModel):
    mcpServers: dict[str, dict]

class McpHub:
    """Model Context Protocol Hub class"""
    
    def __init__(self, mcp_servers: Optional[Dict[str, Any]] = None):
        self._servers = []
        self._mcp_commands = []
        self._mcp_urls = []
        self._mcp_envs = {}
        self._server_statuses: Dict[str, Dict[str, str]] = {} # 各サーバーのステータスを保持

        if mcp_servers:
            for server_name, config in mcp_servers.items():
                if config.get("type") == "stdio":
                    command_str = config["command"]
                    if config.get("args"):
                        command_str += " " + " ".join(config["args"])
                    self._mcp_commands.append(command_str)
                    if config.get("env"):
                        self._mcp_envs.update(config["env"])
                elif config.get("type") == "sse" or config.get("type") == "streamable-http":
                    self._mcp_urls.append(config["url"])
                # Add other types if needed

                # For get_servers, we can still keep the original structure if needed for system prompt generation
                self._servers.append({"name": server_name, "config": config})
                self._server_statuses[server_name] = {
                    "status": "unknown",
                    "host": config.get("host", "N/A"),
                    "port": config.get("port", "N/A"),
                    "disabled": config.get("disabled", False) # disabledプロパティを追加
                }
    
    def get_servers(self) -> List[Dict[str, Any]]:
        """Get list of MCP servers"""
        # _serversにはconfig全体が含まれているので、disabledも含まれる
        return self._servers

    def update_server_status(self, server_name: str, status: str):
        """Update the status of a specific MCP server."""
        if server_name in self._server_statuses:
            self._server_statuses[server_name]["status"] = status
        else:
            # mcp_setting.jsonにないサーバーの場合も考慮
            self._server_statuses[server_name] = {
                "status": status,
                "host": "N/A",
                "port": "N/A",
                "disabled": False # デフォルトで有効
            }
    
    def get_servers(self) -> List[Dict[str, Any]]:
        """Get list of MCP servers"""
        return self._servers

    def update_server_status(self, server_name: str, status: str):
        """Update the status of a specific MCP server."""
        if server_name in self._server_statuses:
            self._server_statuses[server_name]["status"] = status
        else:
            # mcp_setting.jsonにないサーバーの場合も考慮
            self._server_statuses[server_name] = {"status": status, "host": "N/A", "port": "N/A"}

    def get_server_statuses(self) -> Dict[str, Dict[str, str]]:
        """Get the current statuses of all MCP servers."""
        return self._server_statuses

    @property
    def commands(self) -> List[str]:
        return self._mcp_commands

    @property
    def urls(self) -> List[str]:
        return self._mcp_urls

    @property
    def envs(self) -> Dict[str, str]:
        return self._mcp_envs
    



class BrowserSettings:
    """Browser settings configuration"""
    
    def __init__(self, viewport_width: int = 1280, viewport_height: int = 720):
        self.viewport = {
            'width': viewport_width,
            'height': viewport_height
        }
