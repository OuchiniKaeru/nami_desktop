from typing import List
from agno.tools import Toolkit
from agno.utils.log import logger

class GrepTools(Toolkit):
    def __init__(self):
        super().__init__(name="grep_tool")
        self.register(self.grep)

    def grep(pattern: str, path: str, include: str = None) -> List[str]:
        """Searches for a pattern in files.

        Args:
            pattern: The regular expression pattern to search for.
            path: The directory to search in.
            include: A glob pattern to filter files.

        Returns:
            A list of file paths with at least one match.
        """
        import os
        import re
        import fnmatch
        from typing import List

        logger.info(f"Running grep command: {pattern}")

        results = []
        regex = re.compile(pattern)
        for root, _, files in os.walk(path):
            for file in files:
                if include and not fnmatch.fnmatch(file, include):
                    continue
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        if regex.search(f.read()):
                            results.append(file_path)
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")
        return results
