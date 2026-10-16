"""The test suite must only ever touch a database on this machine."""
import os
import subprocess
import sys
from pathlib import Path

from tests.conftest import is_local_mongo

BACKEND = Path(__file__).resolve().parent.parent


def test_only_this_machine_counts_as_a_local_database():
    for url in ("mongodb://127.0.0.1:27017", "mongodb://localhost:27017/dentor", "mongodb://localhost",
                "mongodb://user:secret@127.0.0.1:27017/?authSource=admin", "mongodb://[::1]:27017"):
        assert is_local_mongo(url), url
    for url in ("mongodb+srv://user:secret@cluster0.example.mongodb.net/dentor",
                "mongodb://user:secret@db.example.com:27017/dentor",
                "mongodb://10.0.0.12:27017", "mongodb://127.0.0.1:27017,db.example.com:27017",
                "mongodb://localhost.example.com:27017", "mongodb://", ""):
        assert not is_local_mongo(url), url


def test_the_suite_refuses_to_start_against_a_remote_database():
    """Run pytest in a child process with a remote MONGO_URL: it must stop before touching anything."""
    env = {**os.environ, "MONGO_URL": "mongodb://user:secret@db.invalid:27017/dentor"}
    run = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "tests/test_safety.py", "-k", "only_this_machine"],
        cwd=BACKEND, env=env, capture_output=True, text=True, timeout=120,
    )
    output = run.stdout + run.stderr
    assert run.returncode != 0, output
    assert "Refusing to run the tests" in output
    assert " passed" not in output and " failed" not in output  # nothing was collected or run
