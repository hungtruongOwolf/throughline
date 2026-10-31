//! Multi-day, dependency-aware appointment scheduling (spec 7.3, "Scheduler").
//!
//! Orders are placed in dependency order. Each order may go on a day the plan already uses or
//! on the earliest day it fits, so the search stays small while it looks for the fewest visit
//! days. Cost: fewest visit days, then shortest span, then fewest preference misses, then the
//! earliest finish. The alternative is the same search with the primary's first day forbidden.

use std::collections::{BTreeSet, HashMap};

use crate::time;
use crate::types::{
    DependencyKind, EngineError, SchedulePlan, ScheduleRequest, ScheduleResult,
    ScheduledAppointment, TimeOfDay,
};

const SLOT_MIN: f64 = 15.0;
/// Time between two appointments of the same patient on the same day (walking, check-in).
const BUFFER_MIN: f64 = 10.0;
const EPS: f64 = 1e-6;
const MONTHS: [&str; 12] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

#[derive(Clone, Copy)]
struct Slot {
    start: f64,
    capacity: u32,
}

struct Prepared {
    order_id: String,
    station_id: String,
    label: String,
    duration: f64,
    station: usize,
    not_before: f64,
    /// (index of the predecessor, kind, gap minutes)
    preds: Vec<(usize, DependencyKind, f64)>,
}

#[derive(Clone, Copy)]
struct Placement {
    start: f64,
    end: f64,
    day: i64,
    first_slot: usize,
    slots: usize,
}

#[derive(Clone)]
struct Best {
    days: usize,
    span: i64,
    misses: usize,
    finish: f64,
    placements: Vec<Placement>,
}

impl Best {
    fn key(&self) -> (usize, i64, usize, f64) {
        (self.days, self.span, self.misses, self.finish)
    }

    fn better_than(&self, other: &Best) -> bool {
        let (a, b) = (self.key(), other.key());
        if a.0 != b.0 {
            return a.0 < b.0;
        }
        if a.1 != b.1 {
            return a.1 < b.1;
        }
        if a.2 != b.2 {
            return a.2 < b.2;
        }
        a.3 < b.3 - EPS
    }
}

struct Search<'a> {
    offset_min: i64,
    earliest: f64,
    latest: f64,
    orders: Vec<Prepared>,
    /// Same-day groups in dependency order; members in dependency order.
    groups: Vec<Vec<usize>>,
    slots: Vec<Vec<Slot>>,
    used: Vec<Vec<u32>>,
    availability: Vec<(f64, f64)>,
    preference: Option<TimeOfDay>,
    max_span: Option<u32>,
    forbidden_day: Option<i64>,
    placed: Vec<Option<Placement>>,
    best: Option<Best>,
    _req: &'a ScheduleRequest,
}

impl Search<'_> {
    fn day_of(&self, utc: f64) -> i64 {
        ((utc + self.offset_min as f64) / 1440.0).floor() as i64
    }

    fn local_hour(&self, utc: f64) -> f64 {
        let local = utc + self.offset_min as f64;
        (local - (local / 1440.0).floor() * 1440.0) / 60.0
    }

    fn available(&self, start: f64, end: f64) -> bool {
        self.availability.is_empty()
            || self
                .availability
                .iter()
                .any(|&(a, b)| start >= a - EPS && end <= b + EPS)
    }

    fn overlaps_patient(&self, start: f64, end: f64) -> bool {
        self.placed
            .iter()
            .flatten()
            .any(|p| start < p.end + BUFFER_MIN - EPS && end + BUFFER_MIN > p.start + EPS)
    }

    /// The earliest placement of order `i` at or after `lb`, optionally on one given day.
    fn earliest(&self, i: usize, lb: f64, day: Option<i64>) -> Option<Placement> {
        let o = &self.orders[i];
        let slots = &self.slots[o.station];
        let used = &self.used[o.station];
        let need = (o.duration / SLOT_MIN).ceil().max(1.0) as usize;
        let from = slots.partition_point(|s| s.start < lb - EPS);
        for j in from..slots.len() {
            let start = slots[j].start;
            if start > self.latest + EPS {
                break;
            }
            let d = self.day_of(start);
            if let Some(want) = day {
                if d < want {
                    continue;
                }
                if d > want {
                    break;
                }
            }
            if Some(d) == self.forbidden_day {
                continue;
            }
            let fits = (0..need).all(|m| {
                slots.get(j + m).is_some_and(|s| {
                    (s.start - (start + m as f64 * SLOT_MIN)).abs() < EPS
                        && s.capacity > used[j + m]
                })
            });
            if !fits {
                continue;
            }
            let end = start + o.duration;
            if !self.available(start, end) || self.overlaps_patient(start, end) {
                continue;
            }
            return Some(Placement {
                start,
                end,
                day: d,
                first_slot: j,
                slots: need,
            });
        }
        None
    }

    fn place(&mut self, i: usize, p: Placement) {
        let station = self.orders[i].station;
        for k in p.first_slot..p.first_slot + p.slots {
            self.used[station][k] += 1;
        }
        self.placed[i] = Some(p);
    }

    fn unplace(&mut self, i: usize) {
        if let Some(p) = self.placed[i].take() {
            let station = self.orders[i].station;
            for k in p.first_slot..p.first_slot + p.slots {
                self.used[station][k] -= 1;
            }
        }
    }

    fn used_days(&self) -> BTreeSet<i64> {
        self.placed.iter().flatten().map(|p| p.day).collect()
    }

    /// Lower bound on order `i`'s start from what is already placed (other days included).
    fn lower_bound(&self, i: usize) -> f64 {
        let mut lb = self.earliest.max(self.orders[i].not_before);
        for &(pred, _, gap) in &self.orders[i].preds {
            if let Some(p) = self.placed[pred] {
                lb = lb.max(p.end + gap);
            }
        }
        lb
    }

    /// Places every member of a same-day group on `day`, in dependency order, or nothing.
    fn place_group(&mut self, members: &[usize], day: i64) -> bool {
        for (n, &i) in members.iter().enumerate() {
            let lb = self.lower_bound(i);
            if self.day_of(lb) > day {
                members[..n].iter().for_each(|&m| self.unplace(m));
                return false;
            }
            match self.earliest(i, lb, Some(day)) {
                Some(p) => self.place(i, p),
                None => {
                    members[..n].iter().for_each(|&m| self.unplace(m));
                    return false;
                }
            }
        }
        true
    }

    /// Groups are placed one at a time: on a day already used, or the first new day it fits.
    fn search(&mut self, g: usize) {
        if g == self.groups.len() {
            self.consider();
            return;
        }
        let days = self.used_days();
        if let Some(best) = &self.best {
            if days.len() > best.days {
                return;
            }
        }
        let members = self.groups[g].clone();
        let lb_day = members
            .iter()
            .map(|&i| self.day_of(self.lower_bound(i)))
            .max()
            .unwrap_or_else(|| self.day_of(self.earliest));
        let last_day = self.day_of(self.latest);

        let mut tried = BTreeSet::new();
        for day in days.iter().copied().filter(|&d| d >= lb_day) {
            tried.insert(day);
            if self.place_group(&members, day) {
                self.search(g + 1);
                members.iter().for_each(|&m| self.unplace(m));
            }
        }
        for day in lb_day..=last_day {
            if tried.contains(&day) || Some(day) == self.forbidden_day {
                continue;
            }
            if self.place_group(&members, day) {
                self.search(g + 1);
                members.iter().for_each(|&m| self.unplace(m));
                break;
            }
        }
    }

    fn consider(&mut self) {
        let placements: Vec<Placement> =
            self.placed.iter().map(|p| p.expect("all placed")).collect();
        let days: BTreeSet<i64> = placements.iter().map(|p| p.day).collect();
        let span = days.iter().next_back().copied().unwrap_or(0)
            - days.iter().next().copied().unwrap_or(0);
        if let Some(max) = self.max_span {
            if span > i64::from(max) {
                return;
            }
        }
        let misses = match self.preference {
            Some(TimeOfDay::Morning) => placements
                .iter()
                .filter(|p| self.local_hour(p.start) >= 12.0)
                .count(),
            Some(TimeOfDay::Afternoon) => placements
                .iter()
                .filter(|p| self.local_hour(p.start) < 12.0)
                .count(),
            None => 0,
        };
        let candidate = Best {
            days: days.len(),
            span,
            misses,
            finish: placements
                .iter()
                .map(|p| p.end)
                .fold(f64::NEG_INFINITY, f64::max),
            placements,
        };
        if self.best.as_ref().is_none_or(|b| candidate.better_than(b)) {
            self.best = Some(candidate);
        }
    }
}

fn date_words(utc: f64, offset_min: i64) -> String {
    let iso = time::format(utc, offset_min);
    let month: usize = iso[5..7].parse().unwrap_or(1);
    let day: u32 = iso[8..10].parse().unwrap_or(1);
    format!("{} {}", MONTHS[(month - 1).min(11)], day)
}

fn plan_from(search: &Search, best: &Best) -> SchedulePlan {
    let off = search.offset_min;
    let mut appointments: Vec<ScheduledAppointment> = search
        .orders
        .iter()
        .zip(&best.placements)
        .map(|(o, p)| ScheduledAppointment {
            order_id: o.order_id.clone(),
            station_id: o.station_id.clone(),
            start: time::format(p.start, off),
            end: time::format(p.end, off),
        })
        .collect();
    appointments.sort_by(|a, b| a.start.cmp(&b.start));
    let mut visit_days: Vec<String> = best
        .placements
        .iter()
        .map(|p| time::format(p.start, off)[..10].to_string())
        .collect();
    visit_days.sort();
    visit_days.dedup();

    let mut facts = Vec::new();
    for (i, o) in search.orders.iter().enumerate() {
        let p = best.placements[i];
        if o.not_before.is_finite() {
            facts.push(format!(
                "{} is after the authorization decision on {}",
                o.label,
                date_words(o.not_before, off)
            ));
        }
        for &(pred, kind, gap) in &o.preds {
            let q = best.placements[pred];
            let a = &search.orders[pred].label;
            match kind {
                DependencyKind::ResultedBefore => facts.push(format!(
                    "{} on {} so results are back {} h before the {} on {}",
                    a,
                    date_words(q.start, off),
                    (gap / 60.0).round(),
                    o.label,
                    date_words(p.start, off)
                )),
                DependencyKind::SameDayAfter => facts.push(format!(
                    "{} follows {} on the same day, {}",
                    o.label,
                    a,
                    date_words(p.start, off)
                )),
            }
        }
    }
    // The first appointment of each day names that day.
    let mut first_of_day: std::collections::BTreeMap<i64, f64> = std::collections::BTreeMap::new();
    for p in &best.placements {
        let e = first_of_day.entry(p.day).or_insert(p.start);
        *e = e.min(p.start);
    }
    facts.push(format!(
        "{} visit day{}: {}",
        visit_days.len(),
        if visit_days.len() == 1 { "" } else { "s" },
        first_of_day
            .values()
            .map(|&t| date_words(t, off))
            .collect::<Vec<_>>()
            .join(" and ")
    ));
    // Facts are sentences: capitalize the first letter (labels may start lowercase).
    let facts = facts
        .into_iter()
        .map(|f| {
            let mut chars = f.chars();
            chars
                .next()
                .map(|c| c.to_uppercase().collect::<String>() + chars.as_str())
                .unwrap_or_default()
        })
        .collect();
    SchedulePlan {
        appointments,
        visit_days,
        span_days: best.span.max(0) as u32,
        score: (best.days * 1000) as f64 + best.span as f64 * 10.0 + best.misses as f64,
        facts,
    }
}

fn prepare(req: &ScheduleRequest) -> Result<Search<'_>, EngineError> {
    if req.orders.is_empty() || req.orders.len() > 12 {
        return Err(EngineError::new(
            "invalid_request",
            "1 to 12 orders per request",
        ));
    }
    let earliest = time::parse(&req.earliest)?;
    let latest = time::parse(&req.latest)?.utc_min;
    let index: HashMap<&str, usize> = req
        .orders
        .iter()
        .enumerate()
        .map(|(i, o)| (o.order_id.as_str(), i))
        .collect();

    let mut station_index: HashMap<String, usize> = HashMap::new();
    let mut slots: Vec<Vec<Slot>> = Vec::new();
    for cal in &req.calendars {
        let mut list = cal
            .slots
            .iter()
            .map(|s| {
                Ok(Slot {
                    start: time::parse(&s.start)?.utc_min,
                    capacity: s.capacity,
                })
            })
            .collect::<Result<Vec<_>, EngineError>>()?;
        list.sort_by(|a, b| a.start.total_cmp(&b.start));
        station_index.insert(cal.station_id.clone(), slots.len());
        slots.push(list);
    }

    let mut orders = Vec::with_capacity(req.orders.len());
    for o in &req.orders {
        let station = *station_index.get(&o.station_id).ok_or_else(|| {
            EngineError::new(
                "invalid_request",
                format!("no calendar for {}", o.station_id),
            )
        })?;
        orders.push(Prepared {
            order_id: o.order_id.clone(),
            station_id: o.station_id.clone(),
            label: o.label.clone().unwrap_or_else(|| o.order_id.clone()),
            duration: o.duration_min,
            station,
            not_before: match &o.not_before {
                Some(ts) => time::parse(ts)?.utc_min,
                None => f64::NEG_INFINITY,
            },
            preds: Vec::new(),
        });
    }
    for d in &req.dependencies {
        let (Some(&b), Some(&a)) = (index.get(d.order.as_str()), index.get(d.after.as_str()))
        else {
            return Err(EngineError::new(
                "invalid_request",
                "dependency names an unknown order",
            ));
        };
        orders[b].preds.push((a, d.kind, d.min_gap_min));
    }

    // Kahn's algorithm; a cycle is a request error.
    let n = orders.len();
    let mut indegree: Vec<usize> = orders.iter().map(|o| o.preds.len()).collect();
    let mut sequence = Vec::with_capacity(n);
    let mut ready: Vec<usize> = (0..n).filter(|&i| indegree[i] == 0).collect();
    while let Some(i) = ready.first().copied() {
        ready.remove(0);
        sequence.push(i);
        for (j, o) in orders.iter().enumerate() {
            if o.preds.iter().any(|&(p, _, _)| p == i) {
                indegree[j] -= o.preds.iter().filter(|&&(p, _, _)| p == i).count();
                if indegree[j] == 0 {
                    ready.push(j);
                }
            }
        }
    }
    if sequence.len() != n {
        return Err(EngineError::new(
            "invalid_request",
            "dependencies form a cycle",
        ));
    }

    // Orders tied by same-day constraints form one group that is placed on one day.
    let mut root: Vec<usize> = (0..n).collect();
    fn find(root: &mut [usize], x: usize) -> usize {
        let mut r = x;
        while root[r] != r {
            r = root[r];
        }
        root[x] = r;
        r
    }
    for (b, o) in orders.iter().enumerate() {
        for &(a, kind, _) in &o.preds {
            if kind == DependencyKind::SameDayAfter {
                let (ra, rb) = (find(&mut root, a), find(&mut root, b));
                root[ra] = rb;
            }
        }
    }
    let mut unordered: Vec<Vec<usize>> = Vec::new();
    let mut group_of: HashMap<usize, usize> = HashMap::new();
    for &i in &sequence {
        let r = find(&mut root, i);
        let g = *group_of.entry(r).or_insert_with(|| {
            unordered.push(Vec::new());
            unordered.len() - 1
        });
        unordered[g].push(i);
    }
    // Groups in dependency order (Kahn on the group graph): a group goes after every group
    // holding one of its members' predecessors.
    let member_group: Vec<usize> = (0..n).map(|i| group_of[&find(&mut root, i)]).collect();
    let mut group_preds: Vec<BTreeSet<usize>> = vec![BTreeSet::new(); unordered.len()];
    for (b, o) in orders.iter().enumerate() {
        for &(a, _, _) in &o.preds {
            if member_group[a] != member_group[b] {
                group_preds[member_group[b]].insert(member_group[a]);
            }
        }
    }
    let mut groups: Vec<Vec<usize>> = Vec::new();
    let mut done: BTreeSet<usize> = BTreeSet::new();
    while done.len() < unordered.len() {
        let next = (0..unordered.len())
            .find(|g| !done.contains(g) && group_preds[*g].iter().all(|p| done.contains(p)))
            .ok_or_else(|| EngineError::new("invalid_request", "same-day groups form a cycle"))?;
        done.insert(next);
        groups.push(unordered[next].clone());
    }

    let availability = req
        .availability
        .iter()
        .map(|w| Ok((time::parse(&w.start)?.utc_min, time::parse(&w.end)?.utc_min)))
        .collect::<Result<Vec<_>, EngineError>>()?;

    Ok(Search {
        offset_min: earliest.offset_min,
        earliest: earliest.utc_min,
        latest,
        used: slots.iter().map(|s| vec![0; s.len()]).collect(),
        slots,
        orders,
        groups,
        availability,
        preference: req.preferences.time_of_day,
        max_span: req.preferences.max_days_span,
        forbidden_day: None,
        placed: vec![None; n],
        best: None,
        _req: req,
    })
}

/// The primary plan and one alternative that avoids the primary's first visit day.
pub fn schedule(req: &ScheduleRequest) -> Result<ScheduleResult, EngineError> {
    let mut search = prepare(req)?;
    search.search(0);
    let Some(best) = search.best.take() else {
        return Err(EngineError::new(
            "no_feasible_schedule",
            "no slots satisfy the dependencies, availability, and window",
        ));
    };
    let primary = plan_from(&search, &best);
    let first_day = best.placements.iter().map(|p| p.day).min();

    let mut alt = prepare(req)?;
    alt.forbidden_day = first_day;
    alt.search(0);
    let alternative = alt.best.take().map(|b| plan_from(&alt, &b));
    Ok(ScheduleResult {
        primary,
        alternative,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    fn maria() -> ScheduleRequest {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/schedule.json")).unwrap();
        serde_json::from_value(fixture["cases"][0]["request"].clone()).unwrap()
    }

    fn t(ts: &str) -> f64 {
        time::parse(ts).unwrap().utc_min
    }

    /// Checks every rule a plan must keep (spec 12.1 test 18, scheduler part).
    fn check(req: &ScheduleRequest, plan: &SchedulePlan) {
        let by_id: HashMap<&str, &ScheduledAppointment> = plan
            .appointments
            .iter()
            .map(|a| (a.order_id.as_str(), a))
            .collect();
        assert_eq!(by_id.len(), req.orders.len(), "every order booked once");
        for d in &req.dependencies {
            let (a, b) = (by_id[d.after.as_str()], by_id[d.order.as_str()]);
            assert!(
                t(&b.start) >= t(&a.end) + d.min_gap_min - EPS,
                "{} after {}",
                d.order,
                d.after
            );
            if d.kind == DependencyKind::SameDayAfter {
                assert_eq!(
                    a.start[..10],
                    b.start[..10],
                    "{} same day as {}",
                    d.order,
                    d.after
                );
            }
        }
        for o in &req.orders {
            let a = by_id[o.order_id.as_str()];
            if let Some(nb) = &o.not_before {
                assert!(t(&a.start) >= t(nb) - EPS);
            }
            let cal = req
                .calendars
                .iter()
                .find(|c| c.station_id == o.station_id)
                .unwrap();
            assert!(
                cal.slots
                    .iter()
                    .any(|s| s.start == a.start && s.capacity > 0),
                "booked on an open slot"
            );
            if !req.availability.is_empty() {
                assert!(req
                    .availability
                    .iter()
                    .any(|w| t(&a.start) >= t(&w.start) && t(&a.end) <= t(&w.end)));
            }
        }
        let mut times: Vec<(f64, f64)> = plan
            .appointments
            .iter()
            .map(|a| (t(&a.start), t(&a.end)))
            .collect();
        times.sort_by(|x, y| x.0.total_cmp(&y.0));
        for w in times.windows(2) {
            assert!(
                w[1].0 >= w[0].1 + BUFFER_MIN - EPS,
                "the patient is never in two places"
            );
        }
    }

    #[test]
    fn maria_gets_nov_14_and_nov_17_with_an_alternative() {
        let req = maria();
        let r = schedule(&req).unwrap();
        assert_eq!(r.primary.visit_days, ["2026-11-14", "2026-11-17"]);
        check(&req, &r.primary);
        let alt = r.alternative.expect("an alternative");
        assert!(!alt.visit_days.contains(&"2026-11-14".to_string()));
        check(&req, &alt);
    }

    #[test]
    fn without_availability_limits_the_rules_still_hold() {
        let mut req = maria();
        req.availability.clear();
        let r = schedule(&req).unwrap();
        check(&req, &r.primary);
        assert_eq!(r.primary.visit_days.len(), 2);
    }

    #[test]
    fn a_cycle_is_a_request_error() {
        let mut req = maria();
        req.dependencies.push(crate::types::ScheduleDependency {
            order: "o-labs".into(),
            after: "o-infusion".into(),
            kind: DependencyKind::ResultedBefore,
            min_gap_min: 0.0,
        });
        assert_eq!(schedule(&req).unwrap_err().code, "invalid_request");
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(48))]

        /// Random gaps, earliest dates, and a random number of blocked slots: every plan keeps
        /// dependencies, capacity, availability, and never double-books the patient.
        #[test]
        fn plans_keep_every_rule(gap_h in 1u32..72, start_day in 12u32..18, drop_every in 2usize..6) {
            let mut req = maria();
            req.availability.clear();
            req.earliest = format!("2026-11-{start_day:02}T07:00:00-06:00");
            req.dependencies[0].min_gap_min = f64::from(gap_h * 60);
            for cal in &mut req.calendars {
                for (k, s) in cal.slots.iter_mut().enumerate() {
                    if k % drop_every == 0 {
                        s.capacity = 0;
                    }
                }
            }
            match schedule(&req) {
                Ok(r) => {
                    check(&req, &r.primary);
                    if let Some(alt) = &r.alternative {
                        check(&req, alt);
                    }
                }
                Err(e) => prop_assert_eq!(e.code, "no_feasible_schedule"),
            }
        }
    }
}
