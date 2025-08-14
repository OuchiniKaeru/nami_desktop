import subprocess
import os

def execute_bash_command(command: str, requires_approval: bool = False) -> str:
    """Executes a bash command.

    Args:
        command: The command to execute.
        requires_approval: Whether the command requires user approval.

    Returns:
        The output of the command.
    """
    # In a real implementation, you would handle the requires_approval flag.
    # For now, we'll just execute the command.
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        return f"Error: {e.stderr}"

