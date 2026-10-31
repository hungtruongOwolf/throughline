//! Serde structs mirroring the zod schemas in packages/shared/src/engine.ts.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Mobility {
    Walking,
    Wheelchair,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EdgeKind {
    Walk,
    Elevator,
    Stairs,
}

#[derive(Debug, Deserialize)]
pub struct WalkingRouteRequest {
    pub from: String,
    pub to: String,
    pub mobility: Mobility,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct RouteStep {
    pub kind: EdgeKind,
    pub to_node_id: String,
    pub to_label: String,
    pub seconds: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub floor: Option<u32>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct WalkingRoute {
    pub nodes: Vec<String>,
    pub seconds: f64,
    pub steps: Vec<RouteStep>,
}

#[derive(Debug, Deserialize)]
pub struct WaitRequest {
    pub station_id: String,
    pub count: f64,
    #[serde(default)]
    pub open_servers: Option<u32>,
    #[serde(default)]
    pub minutes_until_close: Option<f64>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct WaitEstimate {
    pub est_wait_min: f64,
    pub open_servers: u32,
}

#[derive(Debug, Deserialize)]
pub struct FuseRequest {
    #[serde(default)]
    pub sensed: Option<f64>,
    pub ticketed: f64,
    #[serde(default)]
    pub frame_age_min: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum QueueSource {
    Fused,
    Tickets,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct FuseResult {
    pub count_fused: f64,
    pub source: QueueSource,
}

#[derive(Debug, Deserialize)]
pub struct WalkingMatrixRequest {
    pub node_ids: Vec<String>,
    pub mobility: Mobility,
}

/// `seconds[i][j]` is the walking time from `node_ids[i]` to `node_ids[j]`.
#[derive(Debug, Serialize, PartialEq)]
pub struct WalkingMatrix {
    pub node_ids: Vec<String>,
    pub seconds: Vec<Vec<f64>>,
}

/// Every function is total: bad input comes back as `{ "error": { code, message } }`.
#[derive(Debug, Serialize)]
pub struct EngineError {
    pub code: &'static str,
    pub message: String,
}

#[derive(Serialize)]
struct ErrorEnvelope<'a> {
    error: &'a EngineError,
}

impl EngineError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(&ErrorEnvelope { error: self })
            .unwrap_or_else(|_| r#"{"error":{"code":"internal","message":"serialize"}}"#.into())
    }
}
