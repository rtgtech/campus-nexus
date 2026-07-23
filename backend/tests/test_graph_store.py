from __future__ import annotations

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import graph_store  # noqa: E402


class GraphStoreTest(unittest.TestCase):
    def test_friendship_merge_is_canonical_and_reports_creation(self) -> None:
        driver = Mock()
        driver.execute_query.return_value = SimpleNamespace(
            records=[
                {
                    "friendshipId": "3:9",
                    "userAId": 3,
                    "userBId": 9,
                    "weight": 1.0,
                    "createdAt": "2026-07-17T10:00:00Z",
                }
            ],
            summary=SimpleNamespace(counters=SimpleNamespace(relationships_created=1)),
        )

        with patch.object(graph_store, "_get_driver", return_value=driver):
            friendship, created = graph_store.create_friendship(9, 3)

        self.assertTrue(created)
        self.assertEqual(friendship["friendshipId"], "3:9")
        parameters = driver.execute_query.call_args.kwargs["parameters_"]
        self.assertEqual((parameters["user_a"], parameters["user_b"]), (3, 9))
        self.assertEqual(driver.execute_query.call_args.kwargs["database_"], "neo4j")

    def test_self_friendship_is_rejected_before_querying(self) -> None:
        with self.assertRaises(ValueError):
            graph_store.create_friendship(4, 4)


if __name__ == "__main__":
    unittest.main()
