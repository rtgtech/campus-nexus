from __future__ import annotations

import argparse

from schema_app import SessionLocal, ensure_database_initialized, update_neo4j_graph


def main() -> None:
    parser = argparse.ArgumentParser(description="Build or refresh the Neo4j feed graph")
    parser.add_argument("--bootstrap", action="store_true", help="one-time import of PostgreSQL friendships")
    args = parser.parse_args()

    ensure_database_initialized()
    with SessionLocal() as session:
        graph = update_neo4j_graph(session, bootstrap=args.bootstrap)
    action = "Bootstrapped" if args.bootstrap else "Updated"
    print(f"{action} Neo4j graph ({graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges)")


if __name__ == "__main__":
    main()
