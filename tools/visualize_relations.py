#!/usr/bin/env python3
"""Generate a graph visualization for the relation table.

This script reads the SQLite database used by the Parallelismus backend and renders
all relations (optionally filtered) as a NetworkX graph that gets exported as a PNG.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Dict, Iterable, Tuple

import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
import networkx as nx

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "parallelismus.db"
DEFAULT_OUTPUT = ROOT / "relations_graph.png"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Visualize relation table as a graph")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="Path to parallelismus.db")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output image path (PNG)")
    parser.add_argument("--relation-type", dest="relation_type", help="Filter by relation_type", default=None)
    parser.add_argument("--limit", type=int, default=None, help="Limit number of relations (useful for very large graphs)")
    parser.add_argument("--layout", choices=["spring", "kamada_kawai", "circular"], default="spring",
                        help="Layout algorithm to use for node positions")
    return parser.parse_args()


def load_word_labels(conn: sqlite3.Connection) -> Dict[str, str]:
    labels: Dict[str, str] = {}
    rows = conn.execute("SELECT strong, translation, original FROM word").fetchall()
    for strong, translation, original in rows:
        translations = parse_json_array(translation)
        originals = parse_json_array(original)
        primary = translations[0] if translations else (originals[0] if originals else None)
        labels[strong] = f"{strong}\n{primary}" if primary else strong
    return labels


def parse_json_array(value) -> list:
    if value in (None, "undefined", "null"):
        return []
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return []
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return [value]
        if isinstance(parsed, list):
            return parsed
        return [str(parsed)]
    if isinstance(value, (list, tuple)):
        return list(value)
    return [str(value)]


def load_relations(conn: sqlite3.Connection, relation_type: str | None, limit: int | None) -> Iterable[Tuple[str, str, str]]:
    query = "SELECT source_id, target_id, relation_type FROM relation"
    params = []
    if relation_type:
        query += " WHERE relation_type = ?"
        params.append(relation_type)
    query += " ORDER BY id"
    if limit:
        query += " LIMIT ?"
        params.append(limit)
    return conn.execute(query, params)


def build_graph(rows: Iterable[Tuple[str, str, str]], labels: Dict[str, str]) -> nx.DiGraph:
    graph = nx.DiGraph()
    for source_id, target_id, relation_type in rows:
        if not source_id or not target_id:
            continue
        graph.add_node(source_id, label=labels.get(source_id, source_id))
        graph.add_node(target_id, label=labels.get(target_id, target_id))
        graph.add_edge(source_id, target_id, relation_type=relation_type)
    return graph


def draw_graph(graph: nx.DiGraph, output: Path, layout: str) -> None:
    if len(graph) == 0:
        print("No relations found with the current filters.")
        return
    plt.figure(figsize=(14, 10))
    if layout == "spring":
        pos = nx.spring_layout(graph, seed=42)
    elif layout == "kamada_kawai":
        pos = nx.kamada_kawai_layout(graph)
    else:
        pos = nx.circular_layout(graph)

    edge_attrs = nx.get_edge_attributes(graph, "relation_type")
    relation_types = sorted(set(edge_attrs.values()))
    cmap = plt.get_cmap('tab20')
    color_map = {rtype: cmap(i % 20) for i, rtype in enumerate(relation_types)}
    edge_colors = [color_map[edge_attrs[(u, v)]] for u, v in graph.edges]

    nx.draw_networkx_nodes(graph, pos, node_color="#fef3c7", edgecolors="#fdba74", linewidths=1.5, node_size=850)
    nx.draw_networkx_edges(graph, pos, edge_color=edge_colors, arrows=True, arrowstyle='-|>', arrowsize=14, width=2)
    nx.draw_networkx_labels(graph, pos, labels={n: data.get('label', n) for n, data in graph.nodes(data=True)}, font_size=8)

    # Legend for relation types
    handles = [Line2D([0], [0], color=color_map[rtype], linewidth=3, label=rtype) for rtype in relation_types]
    if handles:
        plt.legend(handles=handles, title="Relation Types", loc="upper left", bbox_to_anchor=(1.02, 1))

    plt.axis('off')
    plt.tight_layout()
    output.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output, dpi=200)
    plt.close()
    print(f"Graph saved to {output}")


def main():
    args = parse_args()
    if not args.db.exists():
        raise SystemExit(f"Database not found at {args.db}")
    with sqlite3.connect(args.db) as conn:
        labels = load_word_labels(conn)
        rows = list(load_relations(conn, args.relation_type, args.limit))
    graph = build_graph(rows, labels)
    draw_graph(graph, args.output, args.layout)

if __name__ == "__main__":
    main()
