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

#[derive(Debug, Clone, Deserialize)]
pub struct SimStop {
    pub station_id: String,
    /// A specific room, e.g. `mp2.ct2`; defaults to the station's first node.
    #[serde(default)]
    pub node_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SimPatient {
    pub id: String,
    pub arrive: String,
    #[serde(default = "default_entrance")]
    pub entrance: String,
    pub mobility: Mobility,
    /// Visit order, already planned (the demo day plans each patient once with the solver).
    pub stops: Vec<SimStop>,
}

fn default_entrance() -> String {
    "mp1.entrance".into()
}

#[derive(Debug, Clone, Deserialize)]
pub struct Disruption {
    pub station_id: String,
    pub from: String,
    pub to: String,
    pub servers_down: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum OpsKind {
    OpenServer,
    Divert,
    CallVolunteer,
    CloseStation,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpsActionLite {
    pub id: String,
    pub kind: OpsKind,
    pub station_id: String,
    pub at: String,
    /// `divert`: how many waiting patients move.
    #[serde(default)]
    pub count: Option<u32>,
    /// `divert`: the sibling station they move to.
    #[serde(default)]
    pub to_station: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SimRequest {
    pub seed: u64,
    pub start: String,
    pub end: String,
    pub patients: Vec<SimPatient>,
    #[serde(default)]
    pub disruptions: Vec<Disruption>,
    /// Actions applied in this run (what-if adds one candidate at a time).
    #[serde(default)]
    pub actions: Vec<OpsActionLite>,
    /// Snapshot interval; 0 turns snapshots off.
    #[serde(default = "default_snapshot")]
    pub snapshot_every_min: f64,
    /// Also return every visit's reach/start/end times (for station boards).
    #[serde(default)]
    pub include_visits: bool,
}

fn default_snapshot() -> f64 {
    1.0
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Snapshot {
    pub at: String,
    pub station_id: String,
    pub count: u32,
    pub open_servers: u32,
    pub est_wait_min: f64,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct PatientOutcome {
    pub id: String,
    pub minutes_on_site: f64,
    pub walking_seconds: f64,
    pub wait_minutes: f64,
    pub finished: bool,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct StationKpi {
    pub station_id: String,
    pub served: u32,
    pub mean_wait_min: f64,
    pub p90_wait_min: f64,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct SimKpis {
    pub patients: u32,
    pub finished: u32,
    pub mean_minutes_on_site: f64,
    pub p90_minutes_on_site: f64,
    pub stations: Vec<StationKpi>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct VisitTimes {
    pub patient_id: String,
    pub station_id: String,
    pub reach: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end: Option<String>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct SimResult {
    pub snapshots: Vec<Snapshot>,
    pub per_patient: Vec<PatientOutcome>,
    pub kpis: SimKpis,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub visits: Vec<VisitTimes>,
}

#[derive(Debug, Deserialize)]
pub struct WhatIfRequest {
    #[serde(flatten)]
    pub sim: SimRequest,
    /// Candidate actions, each evaluated on its own against the baseline.
    pub candidates: Vec<OpsActionLite>,
    pub replicates: u32,
    pub horizon_min: f64,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct WaitStats {
    pub station_id: String,
    pub mean_wait_min: f64,
    pub p90_wait_min: f64,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct ActionEffect {
    pub action_id: String,
    pub station_id: String,
    pub mean_wait_min: f64,
    pub p90_wait_min: f64,
    /// Baseline mean minus this action's mean; positive is better.
    pub delta_min: f64,
    pub affected_journeys: u32,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct WhatIfResult {
    pub baseline: Vec<WaitStats>,
    pub per_action: Vec<ActionEffect>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OrderLite {
    pub order_id: String,
    pub station_id: String,
    pub duration_min: f64,
    /// E.g. the authorization decision for `after_auth` orders: never scheduled earlier.
    #[serde(default)]
    pub not_before: Option<String>,
    /// Short words for the explanation facts ("Labs", "CT").
    #[serde(default)]
    pub label: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DependencyKind {
    /// `order` starts at least `min_gap_min` after `after` ends (results back in time).
    ResultedBefore,
    /// Same calendar day, `order` after `after` ends plus `min_gap_min`.
    SameDayAfter,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ScheduleDependency {
    pub order: String,
    pub after: String,
    pub kind: DependencyKind,
    #[serde(default)]
    pub min_gap_min: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CalendarSlot {
    pub start: String,
    /// Remaining capacity in this 15-minute slot.
    pub capacity: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StationCalendar {
    pub station_id: String,
    pub slots: Vec<CalendarSlot>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TimeWindow {
    pub start: String,
    pub end: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimeOfDay {
    Morning,
    Afternoon,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct SchedulePreferences {
    #[serde(default)]
    pub time_of_day: Option<TimeOfDay>,
    #[serde(default)]
    pub max_days_span: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ScheduleRequest {
    pub orders: Vec<OrderLite>,
    #[serde(default)]
    pub dependencies: Vec<ScheduleDependency>,
    pub calendars: Vec<StationCalendar>,
    /// When the patient can come; empty means any time the stations are open.
    #[serde(default)]
    pub availability: Vec<TimeWindow>,
    #[serde(default)]
    pub preferences: SchedulePreferences,
    pub earliest: String,
    pub latest: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ScheduledAppointment {
    pub order_id: String,
    pub station_id: String,
    pub start: String,
    pub end: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SchedulePlan {
    pub appointments: Vec<ScheduledAppointment>,
    pub visit_days: Vec<String>,
    pub span_days: u32,
    /// Lower is better: visit days dominate, then span, then preference misses.
    pub score: f64,
    /// Plain statements the explanation model may restate.
    pub facts: Vec<String>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct ScheduleResult {
    pub primary: SchedulePlan,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alternative: Option<SchedulePlan>,
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
