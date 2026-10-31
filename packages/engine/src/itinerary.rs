//! Visit-day stop ordering (spec 7.3, "Itinerary solver").
//!
//! Depth-first enumeration of the orderings that satisfy precedence, with branch-and-bound on
//! "time so far + remaining service". Cost = expected finish; ties go to less walking, then to
//! fasting stops earlier. Queues are projected: a stop planned 40 minutes from now uses the
//! queue expected then, decaying from today's count toward the hour-of-day baseline.

use std::collections::HashMap;

use crate::campus::{Campus, Graph, Station};
use crate::queue::round1;
use crate::time::{self, Instant};
use crate::types::{
    Constraint, DiffKind, EngineError, ItineraryPlan, ItineraryRequest, PlannedStop, QueueLite,
    ReplanRequest, ReplanResult, StopDiff, StopReq, StopStatus,
};

/// Solving is factorial; the spec bounds a visit day at 8 stops.
pub const MAX_STOPS: usize = 8;
const EPS: f64 = 1e-9;

/// Where a precedence requirement comes from.
#[derive(Clone, Copy)]
enum Source {
    /// Another stop being solved (index into the pending list).
    Pending(usize),
    /// A fixed time: a finished stop's end, or a known event time.
    Fixed(f64),
}

#[derive(Clone, Copy)]
struct Pred {
    source: Source,
    gap: f64,
}

/// A pending stop with everything the search needs precomputed.
struct Prepared<'a> {
    stop: &'a StopReq,
    station: &'a Station,
    node: String,
    open: f64,
    close: f64,
    not_before: f64,
    preds: Vec<Pred>,
}

#[derive(Clone, Copy, Default)]
struct Timing {
    walk_s: f64,
    arrive: f64,
    start: f64,
    end: f64,
    people_ahead: f64,
    wait: f64,
}

#[derive(Clone)]
struct Candidate {
    finish: f64,
    walking: f64,
    fasting_penalty: usize,
    order: Vec<usize>,
    timings: Vec<Timing>,
}

impl Candidate {
    fn better_than(&self, other: &Candidate) -> bool {
        if (self.finish - other.finish).abs() > EPS {
            return self.finish < other.finish;
        }
        if (self.walking - other.walking).abs() > EPS {
            return self.walking < other.walking;
        }
        self.fasting_penalty < other.fasting_penalty
    }
}

struct Solver<'a> {
    campus: &'a Campus,
    now: Instant,
    pending: Vec<Prepared<'a>>,
    queues: HashMap<&'a str, &'a QueueLite>,
    /// `walk[a][b]` in seconds; index 0 is the starting location, `i + 1` is pending stop `i`.
    walk: Vec<Vec<f64>>,
    remaining_service: Vec<f64>,
    best: Option<Candidate>,
}

impl Solver<'_> {
    fn local_hour(&self, utc_min: f64) -> usize {
        (time::local_clock(self.now, utc_min).0 / 60.0).floor() as usize
    }

    /// People expected in the queue at `at`, and the servers open.
    fn projected_queue(&self, station: &Station, at: f64) -> (f64, u32) {
        let base_now = self
            .campus
            .baseline(&station.id, self.local_hour(self.now.utc_min));
        let base_at = self.campus.baseline(&station.id, self.local_hour(at));
        let (count_now, open) = match self.queues.get(station.id.as_str()) {
            Some(q) => (q.count, q.open_servers.unwrap_or(station.servers)),
            None => (base_now, station.servers),
        };
        if open == 0 {
            return (count_now, 0);
        }
        let rate = f64::from(open) / station.service_min.mean;
        let elapsed = (at - self.now.utc_min).max(0.0);
        let excess = count_now - base_now;
        let excess_then = if excess > 0.0 {
            (excess - rate * elapsed).max(0.0)
        } else {
            (excess + rate * elapsed).min(0.0)
        };
        ((base_at + excess_then).max(0.0), open)
    }

    fn timing(&self, i: usize, t: f64, loc: usize, ends: &[f64]) -> Option<Timing> {
        let p = &self.pending[i];
        let walk_s = self.walk[loc][i + 1];
        let arrive = t + walk_s / 60.0;
        let ready = p
            .preds
            .iter()
            .map(|pred| match pred.source {
                Source::Pending(j) => ends[j] + pred.gap,
                Source::Fixed(at) => at + pred.gap,
            })
            .fold(f64::NEG_INFINITY, f64::max);
        let (people, open) = self.projected_queue(p.station, arrive);
        if open == 0 {
            return None;
        }
        let wait = people * p.station.service_min.mean / f64::from(open);
        let start = (arrive + wait).max(ready).max(p.not_before).max(p.open);
        let end = start + p.stop.duration_min;
        (end <= p.close + EPS).then_some(Timing {
            walk_s,
            arrive,
            start,
            end,
            people_ahead: people,
            wait,
        })
    }

    #[allow(clippy::too_many_arguments)]
    fn search(
        &mut self,
        placed: u32,
        t: f64,
        loc: usize,
        walking: f64,
        order: &mut Vec<usize>,
        timings: &mut Vec<Timing>,
        ends: &mut Vec<f64>,
    ) {
        let n = self.pending.len();
        if order.len() == n {
            let fasting_penalty = order
                .iter()
                .enumerate()
                .filter(|(_, &i)| self.pending[i].stop.fasting)
                .map(|(pos, _)| pos)
                .sum();
            let candidate = Candidate {
                finish: t,
                walking,
                fasting_penalty,
                order: order.clone(),
                timings: timings.clone(),
            };
            if self.best.as_ref().is_none_or(|b| candidate.better_than(b)) {
                self.best = Some(candidate);
            }
            return;
        }
        // Bound: even with no walking or waiting, the remaining service has to fit.
        let remaining: f64 = (0..n)
            .filter(|i| placed & (1 << i) == 0)
            .map(|i| self.remaining_service[i])
            .sum();
        if let Some(best) = &self.best {
            if t + remaining > best.finish + EPS {
                return;
            }
        }
        let first_pending =
            (0..n).any(|i| placed & (1 << i) == 0 && self.pending[i].stop.must_be_first);
        for i in 0..n {
            if placed & (1 << i) != 0 {
                continue;
            }
            if first_pending && !self.pending[i].stop.must_be_first {
                continue;
            }
            let preds_done = self.pending[i].preds.iter().all(|p| match p.source {
                Source::Pending(j) => placed & (1 << j) != 0,
                Source::Fixed(_) => true,
            });
            if !preds_done {
                continue;
            }
            let Some(timing) = self.timing(i, t, loc, ends) else {
                continue;
            };
            order.push(i);
            timings.push(timing);
            ends[i] = timing.end;
            self.search(
                placed | (1 << i),
                timing.end,
                i + 1,
                walking + timing.walk_s,
                order,
                timings,
                ends,
            );
            order.pop();
            timings.pop();
            ends[i] = f64::NAN;
        }
    }
}

/// Inputs shared by plan and replan: fixed stops already happened or are happening.
struct Fixed {
    stops: Vec<PlannedStop>,
    /// order_id → end time (utc minutes).
    ends: HashMap<String, f64>,
    start_time: f64,
    start_node: String,
}

fn solve(
    campus: &Campus,
    req: &ItineraryRequest,
    fixed: Fixed,
) -> Result<(ItineraryPlan, Vec<(usize, Timing)>), EngineError> {
    let now = time::parse(&req.now)?;
    let (now_clock, weekday) = time::local_clock(now, now.utc_min);
    let day_start = now.utc_min - now_clock;

    let pending_stops: Vec<&StopReq> = req
        .stops
        .iter()
        .filter(|s| s.status == StopStatus::Pending)
        .collect();
    if pending_stops.len() > MAX_STOPS {
        return Err(EngineError::new(
            "too_many_stops",
            format!("at most {MAX_STOPS} stops per visit day"),
        ));
    }
    let index: HashMap<&str, usize> = pending_stops
        .iter()
        .enumerate()
        .map(|(i, s)| (s.order_id.as_str(), i))
        .collect();

    let mut pending = Vec::with_capacity(pending_stops.len());
    for stop in &pending_stops {
        let station = campus.station(&stop.station_id)?;
        let Some((open, close)) = station.hours_on(weekday)? else {
            return Err(EngineError::new(
                "station_closed",
                format!("{} is closed that day", station.name),
            ));
        };
        let node = match &stop.node_id {
            Some(n) if station.nodes.contains(n) => n.clone(),
            Some(n) => {
                return Err(EngineError::new(
                    "invalid_request",
                    format!("{n} is not a room of {}", station.id),
                ))
            }
            None => station.nodes[0].clone(),
        };
        let not_before = match &stop.not_before {
            Some(ts) => time::parse(ts)?.utc_min,
            None => f64::NEG_INFINITY,
        };
        pending.push(Prepared {
            stop,
            station,
            node,
            open: day_start + open,
            close: day_start + close,
            not_before,
            preds: Vec::new(),
        });
    }

    let source_of = |order_id: &str| -> Option<Source> {
        index
            .get(order_id)
            .map(|&j| Source::Pending(j))
            .or_else(|| fixed.ends.get(order_id).map(|&e| Source::Fixed(e)))
    };
    for c in &req.constraints {
        let (target, pred) = match c {
            Constraint::Before { a, b, min_gap_min } => (
                b,
                source_of(a).map(|source| Pred {
                    source,
                    gap: *min_gap_min,
                }),
            ),
            Constraint::AfterEvent {
                order,
                lead_min,
                after_order,
                ready_at,
                ..
            } => {
                let source = match (ready_at, after_order) {
                    (Some(ts), _) => Some(Source::Fixed(time::parse(ts)?.utc_min)),
                    (None, Some(a)) => source_of(a),
                    (None, None) => None,
                };
                (
                    order,
                    source.map(|source| Pred {
                        source,
                        gap: *lead_min,
                    }),
                )
            }
        };
        if let (Some(&i), Some(pred)) = (index.get(target.as_str()), pred) {
            pending[i].preds.push(pred);
        }
    }

    let graph = Graph::new(campus, req.mobility)?;
    let mut nodes = vec![graph.node(&fixed.start_node)?];
    for p in &pending {
        nodes.push(graph.node(&p.node)?);
    }
    let walk = nodes
        .iter()
        .map(|&from| {
            let paths = graph.shortest_paths(from);
            nodes.iter().map(|&to| paths.dist[to]).collect()
        })
        .collect();

    let mut solver = Solver {
        campus,
        now,
        remaining_service: pending.iter().map(|p| p.stop.duration_min).collect(),
        pending,
        queues: req
            .queues
            .iter()
            .map(|q| (q.station_id.as_str(), q))
            .collect(),
        walk,
        best: None,
    };
    let n = solver.pending.len();
    let start_time = fixed.start_time.max(now.utc_min);
    solver.search(
        0,
        start_time,
        0,
        0.0,
        &mut Vec::with_capacity(n),
        &mut Vec::with_capacity(n),
        &mut vec![f64::NAN; n],
    );
    let Some(best) = solver.best.take() else {
        return Err(EngineError::new(
            "no_feasible_plan",
            "no ordering fits station hours and constraints",
        ));
    };

    let fmt = |t: f64| time::format(t, now.offset_min);
    let mut stops = fixed.stops;
    let solved: Vec<(usize, Timing)> = best
        .order
        .iter()
        .copied()
        .zip(best.timings.iter().copied())
        .collect();
    for &(i, t) in &solved {
        let p = &solver.pending[i];
        stops.push(PlannedStop {
            order_id: p.stop.order_id.clone(),
            station_id: p.station.id.clone(),
            node_id: p.node.clone(),
            eta_arrive: fmt(t.arrive),
            eta_start: fmt(t.start),
            eta_end: fmt(t.end),
            people_ahead: t.people_ahead.round() as u32,
            est_wait_min: round1(t.wait),
            walk_seconds: t.walk_s,
        });
    }

    let reason = reasons(&solver, &solved, now);
    let first = stops
        .first()
        .map(|s| time::parse(&s.eta_arrive).map(|t| t.utc_min))
        .transpose()?
        .unwrap_or(now.utc_min);
    let last = stops
        .last()
        .map(|s| time::parse(&s.eta_end).map(|t| t.utc_min))
        .transpose()?
        .unwrap_or(now.utc_min);
    Ok((
        ItineraryPlan {
            walking_seconds: stops.iter().map(|s| s.walk_seconds).sum(),
            total_minutes: (last - first).round(),
            stops,
            reason,
        },
        solved,
    ))
}

fn clock(now: Instant, t: f64) -> String {
    let (mins, _) = time::local_clock(now, t.round());
    format!("{}:{:02}", (mins / 60.0) as u32, (mins % 60.0) as u32)
}

/// Plain statements about why the plan looks the way it does; the model may restate them.
fn reasons(solver: &Solver, solved: &[(usize, Timing)], now: Instant) -> Vec<String> {
    let mut out = Vec::new();
    for (pos, &(i, t)) in solved.iter().enumerate() {
        let p = &solver.pending[i];
        let name = &p.station.name;
        if pos == 0 && p.stop.must_be_first {
            out.push(format!("{name} comes first"));
        } else if pos == 0 && p.stop.fasting {
            out.push(format!("{name} early because it is a fasting stop"));
        }
        let queued = t.arrive + t.wait;
        if p.not_before > queued + EPS && (t.start - p.not_before).abs() < EPS {
            out.push(format!("{name} at its booked time {}", clock(now, t.start)));
        } else if t.start > queued + EPS && t.start > p.open + EPS {
            for pred in &p.preds {
                let (what, ready) = match pred.source {
                    Source::Pending(j) => (
                        solver.pending[j].station.name.clone(),
                        solved
                            .iter()
                            .find(|(k, _)| *k == j)
                            .map(|(_, tj)| tj.end)
                            .unwrap_or(0.0),
                    ),
                    Source::Fixed(at) => ("an earlier step".to_string(), at),
                };
                if (ready + pred.gap - t.start).abs() < EPS {
                    out.push(format!(
                        "{name} waits for {what}, ready about {}",
                        clock(now, t.start)
                    ));
                }
            }
        }
        let queue_decided = (t.start - queued).abs() < EPS;
        if queue_decided && t.wait >= 10.0 {
            out.push(format!("{name}: about {} minutes in line", t.wait.round()));
        }
    }
    if let Some(&(_, last)) = solved.last() {
        out.push(format!("Done about {}", clock(now, last.end)));
    }
    out
}

/// Plans a visit day from scratch. Every stop must be pending.
pub fn plan(campus: &Campus, req: &ItineraryRequest) -> Result<ItineraryPlan, EngineError> {
    if req.stops.iter().any(|s| s.status != StopStatus::Pending) {
        return Err(EngineError::new(
            "invalid_request",
            "plan takes pending stops only; use replan",
        ));
    }
    let fixed = Fixed {
        stops: Vec::new(),
        ends: HashMap::new(),
        start_time: f64::NEG_INFINITY,
        start_node: req.location.clone(),
    };
    solve(campus, req, fixed).map(|(plan, _)| plan)
}

/// Re-solves the pending stops; done and in-service stops keep their times exactly.
pub fn replan(campus: &Campus, req: &ReplanRequest) -> Result<ReplanResult, EngineError> {
    let inner = &req.request;
    let current: HashMap<&str, &PlannedStop> = req
        .current
        .stops
        .iter()
        .map(|s| (s.order_id.as_str(), s))
        .collect();
    let mut fixed = Fixed {
        stops: Vec::new(),
        ends: HashMap::new(),
        start_time: f64::NEG_INFINITY,
        start_node: inner.location.clone(),
    };
    // Keep the current plan's order for fixed stops.
    for planned in &req.current.stops {
        let Some(stop) = inner.stops.iter().find(|s| s.order_id == planned.order_id) else {
            continue;
        };
        if stop.status == StopStatus::Pending {
            continue;
        }
        let end = time::parse(&planned.eta_end)?.utc_min;
        fixed.ends.insert(planned.order_id.clone(), end);
        if stop.status == StopStatus::InService {
            fixed.start_time = fixed.start_time.max(end);
            fixed.start_node = planned.node_id.clone();
        }
        fixed.stops.push(planned.clone());
    }
    if let Some(missing) = inner
        .stops
        .iter()
        .find(|s| s.status != StopStatus::Pending && !current.contains_key(s.order_id.as_str()))
    {
        return Err(EngineError::new(
            "invalid_request",
            format!(
                "{} is not pending but is missing from the current plan",
                missing.order_id
            ),
        ));
    }

    let now = time::parse(&inner.now)?;
    let (plan, _) = solve(campus, inner, fixed)?;
    let mut diff = Vec::new();
    let mut reason = Vec::new();
    for new in &plan.stops {
        let Some(old) = current.get(new.order_id.as_str()) else {
            continue;
        };
        let name = campus
            .station(&new.station_id)
            .map(|s| s.name.clone())
            .unwrap_or_else(|_| new.station_id.clone());
        if old.node_id != new.node_id {
            let label = |id: &str| {
                campus
                    .nodes
                    .iter()
                    .find(|n| n.id == id)
                    .map_or(id.to_string(), |n| n.label.clone())
            };
            reason.push(format!(
                "{name} moved from {} to {}",
                label(&old.node_id),
                label(&new.node_id)
            ));
            diff.push(StopDiff {
                order_id: new.order_id.clone(),
                change: DiffKind::SwappedStation,
                from: old.node_id.clone(),
                to: new.node_id.clone(),
            });
            continue;
        }
        let before = time::parse(&old.eta_start)?.utc_min;
        let after = time::parse(&new.eta_start)?.utc_min;
        if (after - before).abs() >= 1.0 {
            let change = if after < before {
                DiffKind::MovedEarlier
            } else {
                DiffKind::MovedLater
            };
            let word = if after < before { "earlier" } else { "later" };
            reason.push(format!(
                "{name} moved {word}, now about {}",
                clock(now, after)
            ));
            diff.push(StopDiff {
                order_id: new.order_id.clone(),
                change,
                from: old.eta_start.clone(),
                to: new.eta_start.clone(),
            });
        }
    }
    Ok(ReplanResult { plan, diff, reason })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::campus::campus;
    use crate::types::Mobility;
    use proptest::prelude::*;

    const STATIONS: [&str; 10] = [
        "registration",
        "lab_draw",
        "imaging_ct",
        "imaging_xray",
        "vitals",
        "clinic_2a",
        "clinic_2b",
        "infusion",
        "pharmacy",
        "financial",
    ];
    const LOCATIONS: [&str; 4] = ["mp1.entrance", "mp1.lobby", "g2.parking", "cc1.lobby"];

    fn t(ts: &str) -> f64 {
        time::parse(ts).unwrap().utc_min
    }

    /// Random visit days: distinct stations, durations, an acyclic set of "before" constraints.
    fn requests() -> impl Strategy<Value = ItineraryRequest> {
        (
            proptest::sample::subsequence(STATIONS.to_vec(), 1..=6),
            proptest::collection::vec(5u32..=45, 6),
            proptest::collection::vec((any::<bool>(), 0u32..=30), 15),
            proptest::collection::vec(0u32..=10, 6),
            7u32..=10,
            0usize..LOCATIONS.len(),
            any::<bool>(),
        )
            .prop_map(
                |(stations, durations, edges, counts, hour, loc, wheelchair)| {
                    let stops: Vec<StopReq> = stations
                        .iter()
                        .enumerate()
                        .map(|(i, s)| StopReq {
                            order_id: format!("o{i}"),
                            station_id: (*s).to_string(),
                            duration_min: f64::from(durations[i]),
                            node_id: None,
                            must_be_first: false,
                            fasting: i == 0,
                            not_before: None,
                            status: StopStatus::Pending,
                        })
                        .collect();
                    let mut constraints = Vec::new();
                    let mut k = 0;
                    for a in 0..stops.len() {
                        for b in (a + 1)..stops.len() {
                            let (on, gap) = edges[k % edges.len()];
                            k += 1;
                            if on {
                                constraints.push(Constraint::Before {
                                    a: format!("o{a}"),
                                    b: format!("o{b}"),
                                    min_gap_min: f64::from(gap),
                                });
                            }
                        }
                    }
                    let queues = stations
                        .iter()
                        .enumerate()
                        .map(|(i, s)| QueueLite {
                            station_id: (*s).to_string(),
                            count: f64::from(counts[i]),
                            open_servers: None,
                        })
                        .collect();
                    ItineraryRequest {
                        now: format!("2026-11-17T{hour:02}:00:00-06:00"),
                        location: LOCATIONS[loc].to_string(),
                        mobility: if wheelchair {
                            Mobility::Wheelchair
                        } else {
                            Mobility::Walking
                        },
                        stops,
                        queues,
                        constraints,
                    }
                },
            )
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(128))]

        /// Spec 12.1 test 18: precedence, monotone ETAs, station hours, every stop once.
        #[test]
        fn plans_respect_the_rules(req in requests()) {
            let c = campus().unwrap();
            let plan = match plan(c, &req) {
                Ok(p) => p,
                Err(e) => {
                    prop_assume!(e.code == "no_feasible_plan");
                    return Ok(());
                }
            };
            prop_assert_eq!(plan.stops.len(), req.stops.len());
            let by_id: HashMap<&str, &PlannedStop> =
                plan.stops.iter().map(|s| (s.order_id.as_str(), s)).collect();
            prop_assert_eq!(by_id.len(), req.stops.len());

            for constraint in &req.constraints {
                if let Constraint::Before { a, b, min_gap_min } = constraint {
                    let (sa, sb) = (by_id[a.as_str()], by_id[b.as_str()]);
                    prop_assert!(t(&sb.eta_start) >= t(&sa.eta_end) + min_gap_min);
                }
            }
            let mut previous_end = f64::NEG_INFINITY;
            for s in &plan.stops {
                let (arrive, start, end) = (t(&s.eta_arrive), t(&s.eta_start), t(&s.eta_end));
                prop_assert!(arrive <= start && start <= end);
                prop_assert!(arrive >= previous_end);
                previous_end = end;

                let station = c.station(&s.station_id).unwrap();
                let (open, close) = station.hours_on(1).unwrap().unwrap();
                let now = time::parse(&req.now).unwrap();
                let (start_clock, _) = time::local_clock(now, start);
                let (end_clock, _) = time::local_clock(now, end);
                prop_assert!(start_clock >= open, "{} starts before opening", s.station_id);
                prop_assert!(end_clock <= close, "{} ends after closing", s.station_id);
            }
        }

        /// Replanning never moves a done stop, and the output is deterministic.
        #[test]
        fn replan_keeps_done_stops(req in requests(), extra in 0u32..=15) {
            let c = campus().unwrap();
            let Ok(current) = plan(c, &req) else { return Ok(()); };
            let first = current.stops[0].clone();
            let mut stops = req.stops.clone();
            for s in &mut stops {
                if s.order_id == first.order_id {
                    s.status = StopStatus::Done;
                }
            }
            let queues = req
                .queues
                .iter()
                .map(|q| QueueLite { count: q.count + f64::from(extra), ..q.clone() })
                .collect();
            let replan_req = ReplanRequest {
                request: ItineraryRequest {
                    now: first.eta_end.clone(),
                    location: first.node_id.clone(),
                    stops,
                    queues,
                    ..req
                },
                current,
            };
            let Ok(result) = replan(c, &replan_req) else { return Ok(()); };
            prop_assert_eq!(&result.plan.stops[0], &first);
            prop_assert!(result.diff.iter().all(|d| d.order_id != first.order_id));
            let again = replan(c, &replan_req).unwrap();
            prop_assert_eq!(result.plan, again.plan);
        }
    }

    #[test]
    fn must_be_first_is_respected() {
        let c = campus().unwrap();
        let req: ItineraryRequest =
            serde_json::from_str(include_str!("../fixtures/maria-request.json")).unwrap();
        let mut req = req;
        req.stops[2].must_be_first = true;
        let p = plan(c, &req).unwrap();
        assert_eq!(p.stops[0].order_id, "o-vitals");
    }

    #[test]
    fn closed_station_is_an_error() {
        let c = campus().unwrap();
        let mut req: ItineraryRequest =
            serde_json::from_str(include_str!("../fixtures/maria-request.json")).unwrap();
        req.now = "2026-11-15T09:00:00-06:00".into(); // Sunday
        assert_eq!(plan(c, &req).unwrap_err().code, "station_closed");
    }
}
