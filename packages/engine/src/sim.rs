//! Discrete-event simulation of the campus (spec 7.3, "Simulation").
//!
//! Patients follow pre-planned stop orders, walk the campus graph, and queue FIFO at
//! multi-server stations with lognormal service times from a seeded ChaCha8 stream.
//! Disruptions take servers away for a window; ops actions change capacity, speed, or divert
//! waiting patients to a sibling station. Same request + seed → identical output.

use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap, VecDeque};

use rand_chacha::ChaCha8Rng;
use rand_core::{RngCore, SeedableRng};

use crate::campus::{Campus, Graph};
use crate::queue::round1;
use crate::time;
use crate::types::{
    ActionEffect, EngineError, Mobility, OpsActionLite, OpsKind, PatientOutcome, SimKpis,
    SimRequest, SimResult, Snapshot, StationKpi, VisitTimes, WaitStats, WhatIfRequest,
    WhatIfResult,
};

/// `call_volunteer`: lobby service runs 30% faster for 30 minutes (spec 7.3).
const VOLUNTEER_SPEEDUP: f64 = 1.3;
const VOLUNTEER_MINUTES: f64 = 30.0;

struct StationModel {
    servers: u32,
    mean: f64,
    /// Lognormal parameters derived from the mean and standard deviation in campus.json.
    mu: f64,
    sigma: f64,
    node: usize,
}

/// Campus data prepared once per call: station models and walking matrices by mobility.
struct World {
    station_ids: Vec<String>,
    stations: Vec<StationModel>,
    station_index: HashMap<String, usize>,
    node_index: HashMap<String, usize>,
    walking: Vec<Vec<f64>>,
    wheelchair: Vec<Vec<f64>>,
}

impl World {
    fn new(campus: &Campus) -> Result<Self, EngineError> {
        let mut node_index = HashMap::new();
        for (i, n) in campus.nodes.iter().enumerate() {
            node_index.insert(n.id.clone(), i);
        }
        let matrix = |mobility| -> Result<Vec<Vec<f64>>, EngineError> {
            let graph = Graph::new(campus, mobility)?;
            Ok((0..campus.nodes.len())
                .map(|from| graph.shortest_paths(from).dist)
                .collect())
        };
        let mut stations = Vec::new();
        let mut station_ids = Vec::new();
        let mut station_index = HashMap::new();
        for (i, s) in campus.stations.iter().enumerate() {
            let cv2 = (s.service_min.sd / s.service_min.mean).powi(2);
            let sigma2 = (1.0 + cv2).ln();
            let node = *node_index.get(&s.nodes[0]).ok_or_else(|| {
                EngineError::new("campus_invalid", format!("station {} has no node", s.id))
            })?;
            stations.push(StationModel {
                servers: s.servers,
                mean: s.service_min.mean,
                mu: s.service_min.mean.ln() - sigma2 / 2.0,
                sigma: sigma2.sqrt(),
                node,
            });
            station_ids.push(s.id.clone());
            station_index.insert(s.id.clone(), i);
        }
        Ok(Self {
            station_ids,
            stations,
            station_index,
            node_index,
            walking: matrix(Mobility::Walking)?,
            wheelchair: matrix(Mobility::Wheelchair)?,
        })
    }

    fn station(&self, id: &str) -> Result<usize, EngineError> {
        self.station_index
            .get(id)
            .copied()
            .ok_or_else(|| EngineError::new("unknown_station", format!("unknown station {id}")))
    }

    fn node(&self, id: &str) -> Result<usize, EngineError> {
        self.node_index
            .get(id)
            .copied()
            .ok_or_else(|| EngineError::new("unknown_node", format!("unknown node {id}")))
    }
}

struct Visit {
    station: usize,
    node: usize,
}

struct PatientPlan {
    id: String,
    arrive: f64,
    entrance: usize,
    wheelchair: bool,
    visits: Vec<Visit>,
}

#[derive(Clone, Copy)]
enum Ev {
    Arrive(usize),
    Reach(usize),
    Done(usize, usize),
    Capacity(usize, i32),
    Speed(usize, f64),
    Divert(usize, u32, usize),
    Snapshot,
}

struct Scheduled {
    at: f64,
    seq: u64,
    ev: Ev,
}

impl PartialEq for Scheduled {
    fn eq(&self, other: &Self) -> bool {
        self.cmp(other) == Ordering::Equal
    }
}
impl Eq for Scheduled {}
impl Ord for Scheduled {
    /// Earliest first (BinaryHeap is a max-heap), ties by insertion order.
    fn cmp(&self, other: &Self) -> Ordering {
        other
            .at
            .total_cmp(&self.at)
            .then_with(|| other.seq.cmp(&self.seq))
    }
}
impl PartialOrd for Scheduled {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Everything one replicate needs, prepared from the request.
struct Prepared {
    start_utc: f64,
    offset_min: i64,
    end: f64,
    patients: Vec<PatientPlan>,
    /// (time, station, delta) capacity changes from disruptions.
    capacity: Vec<(f64, usize, i32)>,
    snapshot_every: f64,
}

fn prepare(world: &World, req: &SimRequest) -> Result<Prepared, EngineError> {
    let start = time::parse(&req.start)?;
    let rel =
        |ts: &str| -> Result<f64, EngineError> { Ok(time::parse(ts)?.utc_min - start.utc_min) };
    let end = rel(&req.end)?;
    let mut patients = Vec::with_capacity(req.patients.len());
    for p in &req.patients {
        let mut visits = Vec::with_capacity(p.stops.len());
        for s in &p.stops {
            let station = world.station(&s.station_id)?;
            let node = match &s.node_id {
                Some(n) => world.node(n)?,
                None => world.stations[station].node,
            };
            visits.push(Visit { station, node });
        }
        patients.push(PatientPlan {
            id: p.id.clone(),
            arrive: rel(&p.arrive)?,
            entrance: world.node(&p.entrance)?,
            wheelchair: p.mobility == Mobility::Wheelchair,
            visits,
        });
    }
    let mut capacity = Vec::new();
    for d in &req.disruptions {
        let s = world.station(&d.station_id)?;
        let down = i32::try_from(d.servers_down).unwrap_or(i32::MAX);
        capacity.push((rel(&d.from)?, s, -down));
        capacity.push((rel(&d.to)?, s, down));
    }
    Ok(Prepared {
        start_utc: start.utc_min,
        offset_min: start.offset_min,
        end,
        patients,
        capacity,
        snapshot_every: req.snapshot_every_min,
    })
}

/// A standard normal from two uniforms (Box–Muller).
fn normal(rng: &mut ChaCha8Rng) -> f64 {
    let u = |rng: &mut ChaCha8Rng| ((rng.next_u64() >> 11) as f64 + 0.5) / (1u64 << 53) as f64;
    let (u1, u2) = (u(rng), u(rng));
    (-2.0 * u1.ln()).sqrt() * (std::f64::consts::TAU * u2).cos()
}

/// (patient, station, reach, service start, service end) for one visit.
type VisitLog = (usize, usize, f64, Option<f64>, Option<f64>);

struct Run<'a> {
    world: &'a World,
    prep: &'a Prepared,
    rng: ChaCha8Rng,
    heap: BinaryHeap<Scheduled>,
    seq: u64,
    now: f64,
    queues: Vec<VecDeque<(usize, f64)>>,
    busy: Vec<u32>,
    open: Vec<i32>,
    speed: Vec<f64>,
    /// Per patient: index of the current visit, the station actually used per visit, walking, waits.
    next_visit: Vec<usize>,
    station_override: Vec<Vec<Option<usize>>>,
    walked: Vec<f64>,
    waited: Vec<f64>,
    finished_at: Vec<Option<f64>>,
    /// Per station: (service start time, wait minutes, patient).
    waits: Vec<Vec<(f64, f64, usize)>>,
    /// (patient, station, reach, start, end) for every visit, when requested.
    visits: Option<Vec<VisitLog>>,
    /// Index into `visits` of each patient's open visit.
    open_visit: Vec<Option<usize>>,
    snapshots: Vec<Snapshot>,
}

impl<'a> Run<'a> {
    fn new(world: &'a World, prep: &'a Prepared, seed: u64) -> Self {
        let n = world.stations.len();
        Self {
            world,
            prep,
            rng: ChaCha8Rng::seed_from_u64(seed),
            heap: BinaryHeap::new(),
            seq: 0,
            now: 0.0,
            queues: vec![VecDeque::new(); n],
            busy: vec![0; n],
            open: world.stations.iter().map(|s| s.servers as i32).collect(),
            speed: vec![1.0; n],
            next_visit: vec![0; prep.patients.len()],
            station_override: prep
                .patients
                .iter()
                .map(|p| vec![None; p.visits.len()])
                .collect(),
            walked: vec![0.0; prep.patients.len()],
            waited: vec![0.0; prep.patients.len()],
            finished_at: vec![None; prep.patients.len()],
            waits: vec![Vec::new(); n],
            snapshots: Vec::new(),
            visits: None,
            open_visit: vec![None; prep.patients.len()],
        }
    }

    fn schedule(&mut self, at: f64, ev: Ev) {
        self.seq += 1;
        self.heap.push(Scheduled {
            at,
            seq: self.seq,
            ev,
        });
    }

    fn walk_min(&self, p: usize, from: usize, to: usize) -> f64 {
        let plan = &self.prep.patients[p];
        let m = if plan.wheelchair {
            &self.world.wheelchair
        } else {
            &self.world.walking
        };
        m[from][to] / 60.0
    }

    fn station_of(&self, p: usize, visit: usize) -> usize {
        self.station_override[p][visit].unwrap_or(self.prep.patients[p].visits[visit].station)
    }

    fn node_of(&self, p: usize, visit: usize) -> usize {
        match self.station_override[p][visit] {
            Some(s) => self.world.stations[s].node,
            None => self.prep.patients[p].visits[visit].node,
        }
    }

    fn service_time(&mut self, s: usize) -> f64 {
        let model = &self.world.stations[s];
        let (mu, sigma) = (model.mu, model.sigma);
        (mu + sigma * normal(&mut self.rng)).exp() / self.speed[s]
    }

    fn try_start(&mut self, s: usize) {
        while i64::from(self.busy[s]) < i64::from(self.open[s].max(0)) {
            let Some((p, reached)) = self.queues[s].pop_front() else {
                break;
            };
            self.busy[s] += 1;
            if let (Some(v), Some(i)) = (self.visits.as_mut(), self.open_visit[p]) {
                v[i].3 = Some(self.now);
            }
            let wait = self.now - reached;
            self.waited[p] += wait;
            self.waits[s].push((self.now, wait, p));
            let service = self.service_time(s);
            self.schedule(self.now + service, Ev::Done(s, p));
        }
    }

    fn snapshot(&mut self) {
        let at = time::format(self.prep.start_utc + self.now, self.prep.offset_min);
        for (s, model) in self.world.stations.iter().enumerate() {
            let count = self.queues[s].len() as u32;
            let open = self.open[s].max(0) as u32;
            let est = if open == 0 {
                f64::from(count) * model.mean
            } else {
                f64::from(count) * model.mean / f64::from(open)
            };
            self.snapshots.push(Snapshot {
                at: at.clone(),
                station_id: self.world.station_ids[s].clone(),
                count,
                open_servers: open,
                est_wait_min: round1(est),
            });
        }
    }

    fn run(mut self, actions: &[OpsActionLite]) -> Result<Self, EngineError> {
        for (p, plan) in self.prep.patients.iter().enumerate() {
            self.schedule(plan.arrive.max(0.0), Ev::Arrive(p));
        }
        for &(at, s, delta) in &self.prep.capacity {
            self.schedule(at.max(0.0), Ev::Capacity(s, delta));
        }
        for a in actions {
            let s = self.world.station(&a.station_id)?;
            let at = (time::parse(&a.at)?.utc_min - self.prep.start_utc).max(0.0);
            match a.kind {
                OpsKind::OpenServer => self.schedule(at, Ev::Capacity(s, 1)),
                OpsKind::CloseStation => self.schedule(at, Ev::Capacity(s, -10_000)),
                OpsKind::CallVolunteer => {
                    self.schedule(at, Ev::Speed(s, VOLUNTEER_SPEEDUP));
                    self.schedule(at + VOLUNTEER_MINUTES, Ev::Speed(s, 1.0));
                }
                OpsKind::Divert => {
                    let to = self.world.station(a.to_station.as_deref().ok_or_else(|| {
                        EngineError::new("invalid_request", "divert needs to_station")
                    })?)?;
                    self.schedule(at, Ev::Divert(s, a.count.unwrap_or(1), to));
                }
            }
        }
        if self.prep.snapshot_every > 0.0 {
            self.schedule(0.0, Ev::Snapshot);
        }

        while let Some(Scheduled { at, ev, .. }) = self.heap.pop() {
            if at > self.prep.end {
                break;
            }
            self.now = at;
            match ev {
                Ev::Arrive(p) => {
                    let plan = &self.prep.patients[p];
                    if plan.visits.is_empty() {
                        self.finished_at[p] = Some(self.now);
                        continue;
                    }
                    let walk = self.walk_min(p, plan.entrance, self.node_of(p, 0));
                    self.walked[p] += walk * 60.0;
                    self.schedule(self.now + walk, Ev::Reach(p));
                }
                Ev::Reach(p) => {
                    let s = self.station_of(p, self.next_visit[p]);
                    if let Some(v) = self.visits.as_mut() {
                        self.open_visit[p] = Some(v.len());
                        v.push((p, s, self.now, None, None));
                    }
                    self.queues[s].push_back((p, self.now));
                    self.try_start(s);
                }
                Ev::Done(s, p) => {
                    self.busy[s] -= 1;
                    if let (Some(v), Some(i)) = (self.visits.as_mut(), self.open_visit[p]) {
                        v[i].4 = Some(self.now);
                    }
                    let from = self.node_of(p, self.next_visit[p]);
                    self.next_visit[p] += 1;
                    if self.next_visit[p] < self.prep.patients[p].visits.len() {
                        let walk = self.walk_min(p, from, self.node_of(p, self.next_visit[p]));
                        self.walked[p] += walk * 60.0;
                        self.schedule(self.now + walk, Ev::Reach(p));
                    } else {
                        self.finished_at[p] = Some(self.now);
                    }
                    self.try_start(s);
                }
                Ev::Capacity(s, delta) => {
                    self.open[s] = if delta <= -10_000 {
                        0
                    } else {
                        self.open[s] + delta
                    };
                    self.try_start(s);
                }
                Ev::Speed(s, factor) => self.speed[s] = factor,
                Ev::Divert(s, count, to) => {
                    // The last people in line move: they would have waited longest.
                    let from_node = self.world.stations[s].node;
                    for _ in 0..count {
                        let Some((p, _)) = self.queues[s].pop_back() else {
                            break;
                        };
                        let visit = self.next_visit[p];
                        self.station_override[p][visit] = Some(to);
                        let walk = self.walk_min(p, from_node, self.world.stations[to].node);
                        self.walked[p] += walk * 60.0;
                        self.schedule(self.now + walk, Ev::Reach(p));
                    }
                }
                Ev::Snapshot => {
                    self.snapshot();
                    self.schedule(self.now + self.prep.snapshot_every, Ev::Snapshot);
                }
            }
        }
        Ok(self)
    }
}

fn percentile(values: &mut [f64], p: f64) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    values.sort_by(f64::total_cmp);
    let rank = ((p * values.len() as f64).ceil() as usize).clamp(1, values.len());
    values[rank - 1]
}

fn mean(values: &[f64]) -> f64 {
    if values.is_empty() {
        0.0
    } else {
        values.iter().sum::<f64>() / values.len() as f64
    }
}

/// One replicate with 60-second snapshots (spec 7.2 `simulate`).
pub fn simulate(campus: &Campus, req: &SimRequest) -> Result<SimResult, EngineError> {
    let world = World::new(campus)?;
    let prep = prepare(&world, req)?;
    let mut run = Run::new(&world, &prep, req.seed);
    if req.include_visits {
        run.visits = Some(Vec::new());
    }
    let mut run = run.run(&req.actions)?;
    let fmt = |t: f64| time::format(prep.start_utc + t, prep.offset_min);
    let visits = run
        .visits
        .take()
        .unwrap_or_default()
        .into_iter()
        .map(|(p, s, reach, start, end)| VisitTimes {
            patient_id: prep.patients[p].id.clone(),
            station_id: world.station_ids[s].clone(),
            reach: fmt(reach),
            start: start.map(fmt),
            end: end.map(fmt),
        })
        .collect();

    let per_patient: Vec<PatientOutcome> = prep
        .patients
        .iter()
        .enumerate()
        .map(|(p, plan)| {
            let end = run.finished_at[p].unwrap_or(prep.end);
            PatientOutcome {
                id: plan.id.clone(),
                minutes_on_site: round1((end - plan.arrive).max(0.0)),
                walking_seconds: run.walked[p].round(),
                wait_minutes: round1(run.waited[p]),
                finished: run.finished_at[p].is_some(),
            }
        })
        .collect();
    let mut on_site: Vec<f64> = per_patient.iter().map(|p| p.minutes_on_site).collect();
    let stations = world
        .station_ids
        .iter()
        .enumerate()
        .map(|(s, id)| {
            let mut w: Vec<f64> = run.waits[s].iter().map(|x| x.1).collect();
            StationKpi {
                station_id: id.clone(),
                served: w.len() as u32,
                mean_wait_min: round1(mean(&w)),
                p90_wait_min: round1(percentile(&mut w, 0.9)),
            }
        })
        .collect();
    let kpis = SimKpis {
        patients: per_patient.len() as u32,
        finished: per_patient.iter().filter(|p| p.finished).count() as u32,
        mean_minutes_on_site: round1(mean(&on_site)),
        p90_minutes_on_site: round1(percentile(&mut on_site, 0.9)),
        stations,
    };
    Ok(SimResult {
        snapshots: run.snapshots,
        per_patient,
        kpis,
        visits,
    })
}

/// Waits (minutes) at `station` for service starting inside the window, plus who was served.
fn window_waits(run: &Run, station: usize, from: f64, to: f64) -> (Vec<f64>, Vec<usize>) {
    let mut waits = Vec::new();
    let mut who = Vec::new();
    for &(start, wait, p) in &run.waits[station] {
        if start >= from && start <= to {
            waits.push(wait);
            who.push(p);
        }
    }
    (waits, who)
}

/// Compares candidate ops actions against the baseline over `replicates` seeds, using common
/// random numbers (replicate r uses seed + r in every scenario) so differences are the action's.
/// Every scenario replays the day from `start`; waits are measured from the earliest candidate
/// time for `horizon_min` minutes, so patients already in the building are not double-counted.
pub fn what_if(campus: &Campus, req: &WhatIfRequest) -> Result<WhatIfResult, EngineError> {
    if req.replicates == 0 || req.replicates > 200 {
        return Err(EngineError::new(
            "invalid_request",
            "replicates must be 1..=200",
        ));
    }
    let world = World::new(campus)?;
    let mut prep = prepare(&world, &req.sim)?;
    let mut window_start = f64::INFINITY;
    for a in &req.candidates {
        window_start = window_start.min(time::parse(&a.at)?.utc_min - prep.start_utc);
    }
    let window_end = window_start + req.horizon_min;
    prep.snapshot_every = 0.0;
    prep.end = prep.end.min(window_end);

    let stations: Vec<usize> = req
        .candidates
        .iter()
        .map(|a| world.station(&a.station_id))
        .collect::<Result<_, _>>()?;
    let mut targets = stations.clone();
    targets.sort_unstable();
    targets.dedup();

    let mut baseline_waits: HashMap<usize, Vec<f64>> = HashMap::new();
    let mut action_waits: Vec<Vec<f64>> = vec![Vec::new(); req.candidates.len()];
    let mut affected: Vec<std::collections::HashSet<usize>> =
        vec![Default::default(); req.candidates.len()];

    for r in 0..u64::from(req.replicates) {
        let seed = req.sim.seed.wrapping_add(r);
        let base = Run::new(&world, &prep, seed).run(&req.sim.actions)?;
        for &s in &targets {
            let (w, _) = window_waits(&base, s, window_start, window_end);
            baseline_waits.entry(s).or_default().extend(w);
        }
        for (i, candidate) in req.candidates.iter().enumerate() {
            let mut actions = req.sim.actions.clone();
            actions.push(candidate.clone());
            let run = Run::new(&world, &prep, seed).run(&actions)?;
            let (w, who) = window_waits(&run, stations[i], window_start, window_end);
            action_waits[i].extend(w);
            affected[i].extend(who);
        }
    }

    let baseline = targets
        .iter()
        .map(|&s| {
            let mut w = baseline_waits.remove(&s).unwrap_or_default();
            WaitStats {
                station_id: world.station_ids[s].clone(),
                mean_wait_min: round1(mean(&w)),
                p90_wait_min: round1(percentile(&mut w, 0.9)),
            }
        })
        .collect::<Vec<_>>();
    let per_action = req
        .candidates
        .iter()
        .enumerate()
        .map(|(i, a)| {
            let base_mean = baseline
                .iter()
                .find(|b| b.station_id == a.station_id)
                .map_or(0.0, |b| b.mean_wait_min);
            let mut w = std::mem::take(&mut action_waits[i]);
            let m = round1(mean(&w));
            ActionEffect {
                action_id: a.id.clone(),
                station_id: a.station_id.clone(),
                mean_wait_min: m,
                p90_wait_min: round1(percentile(&mut w, 0.9)),
                delta_min: round1(base_mean - m),
                affected_journeys: affected[i].len() as u32,
            }
        })
        .collect();
    Ok(WhatIfResult {
        baseline,
        per_action,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::campus::campus;

    fn day() -> SimRequest {
        let mut req: SimRequest =
            serde_json::from_str(include_str!("../../../fixtures/day-2026-11-17.json")).unwrap();
        req.include_visits = false;
        req.snapshot_every_min = 0.0;
        req
    }

    fn ct_wait(result: &SimResult) -> f64 {
        result
            .kpis
            .stations
            .iter()
            .find(|s| s.station_id == "imaging_ct")
            .unwrap()
            .mean_wait_min
    }

    fn action(kind: OpsKind, station: &str) -> OpsActionLite {
        OpsActionLite {
            id: "a".into(),
            kind,
            station_id: station.into(),
            at: "2026-11-17T09:47:00-06:00".into(),
            count: Some(3),
            to_station: Some("clinic_2b".into()),
        }
    }

    #[test]
    fn same_seed_same_output() {
        let c = campus().unwrap();
        let mut req = day();
        req.snapshot_every_min = 1.0;
        let a = serde_json::to_string(&simulate(c, &req).unwrap()).unwrap();
        let b = serde_json::to_string(&simulate(c, &req).unwrap()).unwrap();
        assert_eq!(a, b);
        req.seed += 1;
        assert_ne!(
            a,
            serde_json::to_string(&simulate(c, &req).unwrap()).unwrap()
        );
    }

    #[test]
    fn everyone_is_served_on_a_normal_day() {
        let r = simulate(campus().unwrap(), &day()).unwrap();
        assert_eq!(r.kpis.finished, r.kpis.patients);
        let visits: u32 = day().patients.iter().map(|p| p.stops.len() as u32).sum();
        let served: u32 = r.kpis.stations.iter().map(|s| s.served).sum();
        assert_eq!(served, visits);
    }

    #[test]
    fn the_ct_outage_raises_ct_waits_and_open_server_lowers_them() {
        let c = campus().unwrap();
        let mut no_outage = day();
        no_outage.disruptions.clear();
        let outage = simulate(c, &day()).unwrap();
        assert!(ct_wait(&outage) > ct_wait(&simulate(c, &no_outage).unwrap()));
        let mut helped = day();
        helped
            .actions
            .push(action(OpsKind::OpenServer, "imaging_ct"));
        assert!(ct_wait(&simulate(c, &helped).unwrap()) < ct_wait(&outage));
    }

    #[test]
    fn visit_times_are_ordered_and_cover_every_service() {
        let mut req = day();
        req.include_visits = true;
        let r = simulate(campus().unwrap(), &req).unwrap();
        let served: u32 = r.kpis.stations.iter().map(|s| s.served).sum();
        assert_eq!(r.visits.len() as u32, served);
        for v in &r.visits {
            let (reach, start, end) = (
                time::parse(&v.reach).unwrap().utc_min,
                time::parse(v.start.as_ref().unwrap()).unwrap().utc_min,
                time::parse(v.end.as_ref().unwrap()).unwrap().utc_min,
            );
            assert!(reach <= start + 0.5 && start <= end + 0.5);
        }
    }

    #[test]
    fn closing_a_station_stops_service_there() {
        let mut req = day();
        req.actions.push(OpsActionLite {
            at: "2026-11-17T07:00:00-06:00".into(),
            ..action(OpsKind::CloseStation, "pharmacy")
        });
        let r = simulate(campus().unwrap(), &req).unwrap();
        let pharmacy = r
            .kpis
            .stations
            .iter()
            .find(|s| s.station_id == "pharmacy")
            .unwrap();
        assert_eq!(pharmacy.served, 0);
        assert!(r.kpis.finished < r.kpis.patients);
    }

    #[test]
    fn snapshots_report_the_outage_capacity() {
        let mut req = day();
        req.snapshot_every_min = 1.0;
        let r = simulate(campus().unwrap(), &req).unwrap();
        let at = |t: &str| {
            r.snapshots
                .iter()
                .find(|s| s.station_id == "imaging_ct" && s.at == t)
                .unwrap()
                .open_servers
        };
        assert_eq!(at("2026-11-17T09:39:00-06:00"), 2);
        assert_eq!(at("2026-11-17T10:00:00-06:00"), 1);
        assert_eq!(at("2026-11-17T10:30:00-06:00"), 2);
    }

    #[test]
    fn what_if_ranks_the_ct_action_first_and_is_deterministic() {
        let c = campus().unwrap();
        let req = WhatIfRequest {
            sim: day(),
            candidates: vec![
                OpsActionLite {
                    id: "ct".into(),
                    ..action(OpsKind::OpenServer, "imaging_ct")
                },
                OpsActionLite {
                    id: "volunteer".into(),
                    ..action(OpsKind::CallVolunteer, "registration")
                },
                OpsActionLite {
                    id: "divert".into(),
                    ..action(OpsKind::Divert, "clinic_2a")
                },
            ],
            replicates: 20,
            horizon_min: 90.0,
        };
        let a = what_if(c, &req).unwrap();
        assert_eq!(a, what_if(c, &req).unwrap());
        let best = a
            .per_action
            .iter()
            .max_by(|x, y| x.delta_min.total_cmp(&y.delta_min))
            .unwrap();
        assert_eq!(best.action_id, "ct");
        assert!(best.delta_min > 0.0);
    }
}
