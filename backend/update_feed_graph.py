from __future__ import annotations

from feed_ranker import feed_graph_path
from schema_app import SessionLocal, ensure_database_initialized, rebuild_persisted_feed_graph


def main() -> None:
    ensure_database_initialized()
    with SessionLocal() as session:
        graph = rebuild_persisted_feed_graph(session)
    print(f"Updated {feed_graph_path()} ({graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges)")


if __name__ == "__main__":
    main()
