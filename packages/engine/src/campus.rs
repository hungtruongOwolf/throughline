//! Loads campus.json into a graph and answers walking questions (spec 7.3, "Walking").

use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap};
use std::sync::OnceLock;

use serde::Deserialize;

use crate::queue::ServiceModel;
use crate::time::hhmm;
use crate::types::{EdgeKind, EngineError, Mobility, RouteStep, WalkingMatrix, WalkingRoute};

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
pub struct ServiceMin {
    pub mean: f64,
    pub sd: f64,
}

#[derive(Debug, Deserialize)]
pub struct OpenClose {
    pub open: String,
    pub close: String,
}

#[derive(Debug, Deserialize)]
pub struct Hours {
    /// Weekday names ("mon".."fri") with the regular hours.
    pub days: Vec<String>,
    pub open: String,
    pub close: String,
    #[serde(default)]
    pub saturday: Option<OpenClose>,
}

#[derive(Debug, Deserialize)]
pub struct Station {
    pub id: String,
    pub name: String,
    pub nodes: Vec<String>,
    pub waiting_node: Option<String>,
    pub servers: u32,
    pub service_min: ServiceMin,
    pub hours: Hours,
}

impl Station {
    /// Opening and closing minutes after local midnight for a weekday (0 = Monday), if open.
    pub fn hours_on(&self, weekday: usize) -> Result<Option<(f64, f64)>, EngineError> {
        const NAMES: [&str; 7] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
        if self.hours.days.iter().any(|d| d == NAMES[weekday]) {
            return Ok(Some((hhmm(&self.hours.open)?, hhmm(&self.hours.close)?)));
        }
        match (&self.hours.saturday, weekday) {
            (Some(sat), 5) => Ok(Some((hhmm(&sat.open)?, hhmm(&sat.close)?))),
            _ => Ok(None),
        }
    }

    pub fn service_model(&self) -> ServiceModel {
        ServiceModel {
            servers: self.servers,
            mean_service_min: self.service_min.mean,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct Campus {
    pub version: String,
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
    pub stations: Vec<Station>,
    /// People waiting at the top of each hour (0..23), per station.
    pub queue_baselines: HashMap<String, Vec<f64>>,
}

impl Campus {
    /// Baseline queue at a local hour; 0 when the campus has no row for the station.
    pub fn baseline(&self, station_id: &str, hour: usize) -> f64 {
        self.queue_baselines
            .get(station_id)
            .and_then(|row| row.get(hour.min(23)).copied())
            .unwrap_or(0.0)
    }

    pub fn station(&self, id: &str) -> Result<&Station, EngineError> {
        self.stations
            .iter()
            .find(|s| s.id == id)
            .ok_or_else(|| EngineError::new("unknown_station", format!("unknown station {id}")))
    }
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

/// The campus as an adjacency list for one mobility mode. Wheelchair graphs drop stairs.
pub(crate) struct Graph<'a> {
    campus: &'a Campus,
    index: HashMap<&'a str, usize>,
    /// `adjacency[n]` lists `(neighbour, edge index)`.
    adjacency: Vec<Vec<(usize, usize)>>,
}

/// Distances and predecessors from one start node.
pub(crate) struct ShortestPaths {
    pub(crate) dist: Vec<f64>,
    prev: Vec<Option<(usize, usize)>>,
}

impl<'a> Graph<'a> {
    pub(crate) fn new(campus: &'a Campus, mobility: Mobility) -> Result<Self, EngineError> {
        let index: HashMap<&str, usize> = campus
            .nodes
            .iter()
            .enumerate()
            .map(|(i, n)| (n.id.as_str(), i))
            .collect();
        let mut adjacency = vec![Vec::new(); campus.nodes.len()];
        for (e, edge) in campus.edges.iter().enumerate() {
            if mobility == Mobility::Wheelchair && edge.kind == EdgeKind::Stairs {
                continue;
            }
            let (Some(&a), Some(&b)) = (index.get(edge.a.as_str()), index.get(edge.b.as_str()))
            else {
                return Err(EngineError::new(
                    "campus_invalid",
                    "edge references a missing node",
                ));
            };
            adjacency[a].push((b, e));
            adjacency[b].push((a, e));
        }
        Ok(Self {
            campus,
            index,
            adjacency,
        })
    }

    pub(crate) fn node(&self, id: &str) -> Result<usize, EngineError> {
        self.index
            .get(id)
            .copied()
            .ok_or_else(|| EngineError::new("unknown_node", format!("unknown node {id}")))
    }

    /// Dijkstra from `start` to every node (37 nodes, so no early exit is needed).
    pub(crate) fn shortest_paths(&self, start: usize) -> ShortestPaths {
        let n = self.campus.nodes.len();
        let mut dist = vec![f64::INFINITY; n];
        let mut prev = vec![None; n];
        let mut heap = BinaryHeap::new();
        dist[start] = 0.0;
        heap.push(Visit {
            seconds: 0.0,
            node: start,
        });
        while let Some(Visit { seconds, node }) = heap.pop() {
            if seconds > dist[node] {
                continue;
            }
            for &(next, e) in &self.adjacency[node] {
                let candidate = seconds + self.campus.edges[e].seconds;
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
        ShortestPaths { dist, prev }
    }
}

/// Shortest walking route with human-readable steps.
pub fn walking_route(
    campus: &Campus,
    from: &str,
    to: &str,
    mobility: Mobility,
) -> Result<WalkingRoute, EngineError> {
    let graph = Graph::new(campus, mobility)?;
    let start = graph.node(from)?;
    let goal = graph.node(to)?;
    let paths = graph.shortest_paths(start);

    if paths.dist[goal].is_infinite() {
        return Err(EngineError::new(
            "unreachable",
            format!("no route from {from} to {to}"),
        ));
    }

    // Walk the predecessor chain back from the goal, then reverse it.
    let mut path = vec![goal];
    let mut used_edges = Vec::new();
    let mut at = goal;
    while let Some((p, e)) = paths.prev[at] {
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
        seconds: paths.dist[goal],
        steps,
    })
}

/// All-pairs walking seconds between the given nodes (spec 7.3: precomputed on load).
pub fn walking_matrix(
    campus: &Campus,
    node_ids: &[String],
    mobility: Mobility,
) -> Result<WalkingMatrix, EngineError> {
    let graph = Graph::new(campus, mobility)?;
    let targets = node_ids
        .iter()
        .map(|id| graph.node(id))
        .collect::<Result<Vec<_>, _>>()?;
    let seconds = targets
        .iter()
        .map(|&from| {
            let paths = graph.shortest_paths(from);
            targets.iter().map(|&to| paths.dist[to]).collect()
        })
        .collect();
    Ok(WalkingMatrix {
        node_ids: node_ids.to_vec(),
        seconds,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

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

    #[test]
    fn matrix_is_symmetric_with_a_zero_diagonal() {
        let c = campus().unwrap();
        let ids: Vec<String> = c.nodes.iter().map(|n| n.id.clone()).collect();
        let m = walking_matrix(c, &ids, Mobility::Walking).unwrap();
        for i in 0..ids.len() {
            assert_eq!(m.seconds[i][i], 0.0);
            for j in 0..ids.len() {
                assert_eq!(m.seconds[i][j], m.seconds[j][i]);
            }
        }
    }

    fn node_index() -> impl Strategy<Value = usize> {
        0..campus().unwrap().nodes.len()
    }

    proptest! {
        /// Spec 12.1 test 18: wheelchair routes contain no stairs edges.
        #[test]
        fn wheelchair_routes_never_use_stairs(a in node_index(), b in node_index()) {
            let c = campus().unwrap();
            let r = walking_route(c, &c.nodes[a].id, &c.nodes[b].id, Mobility::Wheelchair).unwrap();
            prop_assert!(r.steps.iter().all(|s| s.kind != EdgeKind::Stairs));
        }

        /// A route's seconds equal the sum of its steps, and it ends where it was asked to.
        #[test]
        fn route_seconds_add_up(a in node_index(), b in node_index(), wheelchair in any::<bool>()) {
            let c = campus().unwrap();
            let mobility = if wheelchair { Mobility::Wheelchair } else { Mobility::Walking };
            let r = walking_route(c, &c.nodes[a].id, &c.nodes[b].id, mobility).unwrap();
            let sum: f64 = r.steps.iter().map(|s| s.seconds).sum();
            prop_assert_eq!(r.seconds, sum);
            prop_assert_eq!(r.nodes.first(), Some(&c.nodes[a].id));
            prop_assert_eq!(r.nodes.last(), Some(&c.nodes[b].id));
        }

        /// Wheelchair routes are never faster than walking routes (they use a subgraph).
        #[test]
        fn wheelchair_is_never_faster(a in node_index(), b in node_index()) {
            let c = campus().unwrap();
            let walk = walking_route(c, &c.nodes[a].id, &c.nodes[b].id, Mobility::Walking).unwrap();
            let chair = walking_route(c, &c.nodes[a].id, &c.nodes[b].id, Mobility::Wheelchair).unwrap();
            prop_assert!(chair.seconds >= walk.seconds);
        }
    }
}
