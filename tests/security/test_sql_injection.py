"""Security tests for SQL AST validation, injection defense, and keyword blocking (Tests 041 - 050)."""
from app.tools.sql_tool import SQLQueryTool

sql_tool = SQLQueryTool()

def check_sql(q: str) -> bool:
    try:
        sql_tool._validate_sql(q)
        return True
    except ValueError:
        return False

def test_041_sql_select_allowed():
    assert check_sql("SELECT id, name FROM users LIMIT 10") is True, "SELECT query allowed"

def test_042_sql_drop_table_blocked():
    assert check_sql("DROP TABLE users") is False, "DROP TABLE blocked"

def test_043_sql_delete_from_blocked():
    assert check_sql("DELETE FROM users WHERE id = 1") is False, "DELETE blocked"

def test_044_sql_update_set_blocked():
    assert check_sql("UPDATE users SET role = 'admin'") is False, "UPDATE blocked"

def test_045_sql_insert_into_blocked():
    assert check_sql("INSERT INTO users (name) VALUES ('evil')") is False, "INSERT blocked"

def test_046_sql_stacked_query_semicolon_blocked():
    assert check_sql("SELECT 1; DROP TABLE users;") is False, "Stacked queries blocked"

def test_047_sql_comment_truncation_defense():
    assert check_sql("SELECT * FROM users; -- DROP TABLE") is False, "Comment injection handled"

def test_048_sql_truncate_table_blocked():
    assert check_sql("TRUNCATE TABLE conversations") is False, "TRUNCATE blocked"

def test_049_sql_alter_table_blocked():
    assert check_sql("ALTER TABLE users ADD COLUMN password_leak text") is False, "ALTER TABLE blocked"

def test_050_sql_grant_or_revoke_blocked():
    assert check_sql("GRANT ALL PRIVILEGES ON DATABASE ai_orchestrator TO public") is False, "Privilege escalation blocked"
