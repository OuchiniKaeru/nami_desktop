from typing import List
from agno.tools import Toolkit
from agno.utils.log import logger

class LsTools(Toolkit):
    def __init__(self):
        super().__init__(name="ls_tool")
        self.register(self.list_files)
    
    def list_files(path: str) -> List[str]:
        """Lists files and directories in a given path.

        Args:
            path: The path of the directory to list contents for.

        Returns:
            A list of files and directories.
        """
        import os
        logger.info(f"Running ls command: {path}")
        
        try:
            return os.listdir(path)
        except Exception as e:
            return [f"Error: {e}"]
