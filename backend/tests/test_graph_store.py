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
    def setUp(self):
        graph_store.close_driver()
        self.addCleanup(graph_store.close_driver)

    def test_outage_skips_queries_until_recovery_probe(self):
        driver = Mock()
        driver.execute_query.side_effect = [OSError("offline"), "recovered", "healthy"]
        with patch.object(graph_store, "_get_driver", return_value=driver), patch.object(graph_store, "monotonic", return_value=100) as clock:
            with self.assertRaises(graph_store.GraphUnavailable):
                graph_store._execute("RETURN 1")
            with self.assertRaises(graph_store.GraphUnavailable):
                graph_store._execute("RETURN 1")
            self.assertEqual(driver.execute_query.call_count, 1)
            clock.return_value = 131
            self.assertEqual(graph_store._execute("RETURN 1"), "recovered")
            self.assertEqual(graph_store._execute("RETURN 1"), "healthy")

    def test_concurrent_requests_do_not_duplicate_recovery_probe(self):
        driver = Mock()

        def query(*args, **kwargs):
            with self.assertRaises(graph_store.GraphUnavailable):
                graph_store._execute("RETURN 2")
            return "healthy"

        driver.execute_query.side_effect = query
        with patch.object(graph_store, "_get_driver", return_value=driver):
            self.assertEqual(graph_store._execute("RETURN 1"), "healthy")
        driver.execute_query.assert_called_once()

    def test_connection_attempts_are_bounded_without_transaction_retries(self):
        with patch.dict(graph_store.os.environ, {"NEO4J_URI": "neo4j+s://example.test", "NEO4J_USERNAME": "test", "NEO4J_PASSWORD": "test"}), patch.object(graph_store.GraphDatabase, "driver") as factory:
            graph_store._get_driver()
        self.assertEqual(factory.call_args.kwargs["max_transaction_retry_time"], 0)
        self.assertEqual(factory.call_args.kwargs["connection_timeout"], 2)
        self.assertEqual(factory.call_args.kwargs["connection_acquisition_timeout"], 3)

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

    def test_empty_pagerank_percentile_lookup_skips_neo4j(self) -> None:
        driver = Mock()
        with patch.object(graph_store, "_get_driver", return_value=driver):
            self.assertEqual(graph_store.feed_pagerank_percentiles(), {})
        driver.execute_query.assert_not_called()

    def test_pagerank_percentile_lookup_uses_dynamic_optional_property(self) -> None:
        driver = Mock()
        driver.execute_query.return_value = SimpleNamespace(
            records=[{"key": "user:4", "percentile": 0.0}],
        )
        with patch.object(graph_store, "_get_driver", return_value=driver):
            result = graph_store.feed_pagerank_percentiles(user_ids=[4, 4])

        self.assertEqual(result, {"user:4": 0.0})
        query = driver.execute_query.call_args.args[0]
        parameters = driver.execute_query.call_args.kwargs["parameters_"]
        self.assertIn("node[$percentile_property]", query)
        self.assertNotIn("node.pagerankPercentile", query)
        self.assertEqual(parameters["percentile_property"], "pagerankPercentile")
        self.assertEqual(parameters["user_ids"], [4])


if __name__ == "__main__":
    unittest.main()
