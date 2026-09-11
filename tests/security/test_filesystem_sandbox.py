"""Security tests for workspace boundary enforcement, path traversal defense, and extensions (Tests 051 - 060)."""
from app.tools.file_system import FileSystemTool

fs_tool = FileSystemTool()

def check_path(p: str) -> bool:
    try:
        fs_tool._resolve_safe(p)
        return True
    except (ValueError, PermissionError):
        return False

def test_051_file_sandbox_allowed_relative_path():
    assert check_path("test_sandbox_sample.txt") is True, "Safe relative path permitted"

def test_052_file_sandbox_parent_traversal_dotdot_blocked():
    assert check_path("../app/config.py") is False, "../ blocked"

def test_053_file_sandbox_deep_parent_traversal_blocked():
    assert check_path("../../../../../../../etc/passwd") is False, "Deep ../ blocked"

def test_054_file_sandbox_null_byte_injection_blocked():
    assert check_path("safe.txt\x00../../etc/shadow") is False, "Null byte rejected"

def test_055_file_sandbox_windows_drive_escape_blocked():
    assert check_path("C:\\Windows\\System32\\drivers\\etc\\hosts") is False, "Windows drive escape blocked"

def test_056_file_sandbox_unc_path_blocked():
    assert check_path("\\\\192.168.1.1\\share\\secret.txt") is False, "UNC path escape blocked"

def test_057_file_sandbox_hidden_system_file_defense():
    assert check_path("/root/.ssh/id_rsa") is False, "System root files protected"

def test_058_file_sandbox_list_directory():
    assert check_path(".") is True, "Workspace root path allowed"

def test_059_file_sandbox_nested_path_allowed():
    assert check_path("subfolder/nested/file.py") is True, "Nested path allowed"

def test_060_file_sandbox_windows_backslash_traversal_blocked():
    assert check_path("..\\..\\secret.env") is False, "Backslash traversal blocked"
