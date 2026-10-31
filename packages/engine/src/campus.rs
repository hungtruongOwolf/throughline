//! Loads campus.json into a graph and answers walking-route questions (spec 7.3, "Walking").

use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap};
use std::sync::OnceLock;

use serde::Deserialize;

use crate::types::{EdgeKind, EngineError, Mobility, RouteStep, WalkingRoute};

/// The same file the renderer and the TypeScript graph read, embedded at compile time.
const CAMPUS_JSON: &str = include_str!("../../hospital/campus.json");

#[derive(Debug, Deserialize)]
pub struct Node {
    pub id: String,
    pub floor: u32,
    pub label: String,
}

#[derive(Debug, Deserialize)]
pub struct Edge {
    pub a: String,
    pub b: String,
    pub seconds: f64,
    pub kind: EdgeKind,
}

#[derive(Debug, Deserialize)]
pub struct Campus {
    pub version: String,
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
}

/// Parsed once per process (or per WASM instance) and shared afterwards.
pub fn campus() -> Result<&'static Campus, EngineError> {
    static CAMPUS: OnceLock<Result<Campus, String>> = OnceLock::new();
    CAMPUS
        .get_or_init(|| serde_json::from_str(CAMPUS_JSON).map_err(|e| e.to_string()))
        .as_ref()
        .map_err(|e| EngineError::new("campus_invalid", e.clone()))
}

/// Heap entry for Dijkstra. `BinaryHeap` is a max-heap, so the ordering is reversed.
#[derive(PartialEq)]
struct Visit {
    seconds: f64,
    node: usize,
}

impl Eq for Visit {}

impl Ord for Visit {
    fn cmp(&self, other: &Self) -> Ordering {
        other
            .seconds
            .total_cmp(&self.seconds)
            .then_with(|| other.node.cmp(&self.node))
    }
}

impl PartialOrd for Visit {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Shortest walking route. Wheelchair routes drop stairs edges (spec 3.2).
pub fn walking_route(
    campus: &Campus,
    from: &str,
    to: &str,
    mobility: Mobility,
) -> Result<WalkingRoute, EngineError> {
    let index: HashMap<&str, usize> = campus
        .nodes
        .iter()
        .enumerate()
        .map(|(i, n)| (n.id.as_str(), i))
        .collect();
    let start = *index
        .get(from)
        .ok_or_else(|| EngineError::new("unknown_node", format!("unknown node {from}")))?;
    let goal = *index
        .get(to)
        .ok_or_else(|| EngineError::new("unknown_node", format!("unknown node {to}")))?;

    // Adjacency list of (neighbour, edge index), built per call: 37 nodes, so this is cheap.
    let mut adjacency: Vec<Vec<(usize, usize)>> = vec![Vec::new(); campus.nodes.len()];
    for (e, edge) in campus.edges.iter().enumerate() {
        if mobility == Mobility::Wheelchair && edge.kind == EdgeKind::Stairs {
            continue;
        }
        let (Some(&a), Some(&b)) = (index.get(edge.a.as_str()), index.get(edge.b.as_str())) else {
            return Err(EngineError::new(
                "campus_invalid",
                "edge references a missing node",
            ));
        };
        adjacency[a].push((b, e));
        adjacency[b].push((a, e));
    }

    let mut dist = vec![f64::INFINITY; campus.nodes.len()];
    let mut prev: Vec<Option<(usize, usize)>> = vec![None; campus.nodes.len()];
    let mut heap = BinaryHeap::new();
    dist[start] = 0.0;
    heap.push(Visit {
        seconds: 0.0,
        node: start,
    });

    while let Some(Visit { seconds, node }) = heap.pop() {
        if node == goal {
            break;
        }
        if seconds > dist[node] {
            continue;
        }
        for &(next, e) in &adjacency[node] {
            let candidate = seconds + campus.edges[e].seconds;
            if candidate < dist[next] {
                dist[next] = candidate;
                prev[next] = Some((node, e));
                heap.push(Visit {
                    seconds: candidate,
                    node: next,
                });
            }
        }
    }

    if dist[goal].is_infinite() {
        return Err(EngineError::new(
            "unreachable",
            format!("no route from {from} to {to}"),
        ));
    }

    // Walk the predecessor chain back from the goal, then reverse it.
    let mut path = vec![goal];
    let mut used_edges = Vec::new();
    let mut at = goal;
    while let Some((p, e)) = prev[at] {
        path.push(p);
        used_edges.push(e);
        at = p;
    }
    path.reverse();
    used_edges.reverse();

    let steps = used_edges
        .iter()
        .zip(path.iter().skip(1))
        .map(|(&e, &n)| {
            let edge = &campus.edges[e];
            let target = &campus.nodes[n];
            RouteStep {
                kind: edge.kind,
                to_node_id: target.id.clone(),
                to_label: target.label.clone(),
                seconds: edge.seconds,
                floor: (edge.kind != EdgeKind::Walk).then_some(target.floor),
            }
        })
        .collect();

    Ok(WalkingRoute {
        nodes: path.iter().map(|&i| campus.nodes[i].id.clone()).collect(),
        seconds: dist[goal],
        steps,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entrance_to_ct2_walking_uses_stairs() {
        let r = walking_route(
            campus().unwrap(),
            "mp1.entrance",
            "mp2.ct2",
            Mobility::Walking,
        )
        .unwrap();
        assert_eq!(r.seconds, 155.0);
        assert!(r.steps.iter().any(|s| s.kind == EdgeKind::Stairs));
    }

    #[test]
    fn wheelchair_routes_never_use_stairs() {
        let c = campus().unwrap();
        let r = walking_route(c, "mp1.entrance", "mp2.ct2", Mobility::Wheelchair).unwrap();
        assert_eq!(r.seconds, 229.0);
        for a in &c.nodes {
            for b in &c.nodes {
                let route = walking_route(c, &a.id, &b.id, Mobility::Wheelchair).unwrap();
                assert!(route.steps.iter().all(|s| s.kind != EdgeKind::Stairs));
            }
        }
    }

    #[test]
    fn unknown_node_is_an_error_not_a_panic() {
        let err = walking_route(
            campus().unwrap(),
            "mp1.entrance",
            "nowhere.x",
            Mobility::Walking,
        )
        .unwrap_err();
        assert_eq!(err.code, "unknown_node");
    }
}
