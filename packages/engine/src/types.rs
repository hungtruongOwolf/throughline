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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum StopStatus {
    #[default]
    Pending,
    InService,
    Done,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StopReq {
    pub order_id: String,
    pub station_id: String,
    pub duration_min: f64,
    /// A specific room (e.g. `mp2.ct1`); defaults to the station's first node.
    #[serde(default)]
    pub node_id: Option<String>,
    #[serde(default)]
    pub must_be_first: bool,
    /// Soft preference: fasting stops go early when the plan is otherwise tied.
    #[serde(default)]
    pub fasting: bool,
    /// Booked appointment time; the stop never starts earlier.
    #[serde(default)]
    pub not_before: Option<String>,
    #[serde(default)]
    pub status: StopStatus,
}

#[derive(Debug, Clone, Deserialize)]
pub struct QueueLite {
    pub station_id: String,
    pub count: f64,
    #[serde(default)]
    pub open_servers: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Constraint {
    /// `b` starts at least `min_gap_min` after `a` ends.
    Before {
        a: String,
        b: String,
        #[serde(default)]
        min_gap_min: f64,
    },
    /// `order` waits for an event: either a known `ready_at`, or the end of `after_order`.
    AfterEvent {
        order: String,
        event: String,
        lead_min: f64,
        #[serde(default)]
        after_order: Option<String>,
        #[serde(default)]
        ready_at: Option<String>,
    },
}

#[derive(Debug, Deserialize)]
pub struct ItineraryRequest {
    pub now: String,
    pub location: String,
    pub mobility: Mobility,
    pub stops: Vec<StopReq>,
    #[serde(default)]
    pub queues: Vec<QueueLite>,
    #[serde(default)]
    pub constraints: Vec<Constraint>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlannedStop {
    pub order_id: String,
    pub station_id: String,
    pub node_id: String,
    pub eta_arrive: String,
    pub eta_start: String,
    pub eta_end: String,
    pub people_ahead: u32,
    pub est_wait_min: f64,
    pub walk_seconds: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ItineraryPlan {
    pub stops: Vec<PlannedStop>,
    pub total_minutes: f64,
    pub walking_seconds: f64,
    pub reason: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReplanRequest {
    #[serde(flatten)]
    pub request: ItineraryRequest,
    pub current: ItineraryPlan,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DiffKind {
    MovedEarlier,
    MovedLater,
    SwappedStation,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct StopDiff {
    pub order_id: String,
    pub change: DiffKind,
    pub from: String,
    pub to: String,
}

#[derive(Debug, Serialize)]
pub struct ReplanResult {
    pub plan: ItineraryPlan,
    pub diff: Vec<StopDiff>,
    pub reason: Vec<String>,
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
