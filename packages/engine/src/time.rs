//! Minimal ISO-8601 handling so the engine needs no date crate and no clock.
//! Times are carried as minutes since the Unix epoch (UTC); output keeps the request's offset.

use crate::types::EngineError;

/// Days since 1970-01-01 for a civil date (Howard Hinnant's algorithm).
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let doy = (153 * (m + if m > 2 { -3 } else { 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn civil_from_days(z: i64) -> (i64, i64, i64) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// A parsed timestamp: absolute minutes (UTC) plus the offset it was written in.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Instant {
    pub utc_min: f64,
    pub offset_min: i64,
}

fn num(s: &str, what: &str) -> Result<i64, EngineError> {
    s.parse()
        .map_err(|_| EngineError::new("invalid_time", format!("bad {what} in timestamp")))
}

/// Parses `YYYY-MM-DDTHH:MM[:SS[.fff]](Z|±HH:MM)`.
pub fn parse(ts: &str) -> Result<Instant, EngineError> {
    let bad = || {
        EngineError::new(
            "invalid_time",
            format!("expected ISO time with offset: {ts}"),
        )
    };
    if ts.len() < 17 || !ts.is_char_boundary(10) || &ts[10..11] != "T" {
        return Err(bad());
    }
    let (date, rest) = ts.split_at(10);
    let rest = &rest[1..];
    let (clock, offset_min) = if let Some(c) = rest.strip_suffix('Z') {
        (c, 0)
    } else {
        let split = rest.rfind(['+', '-']).ok_or_else(bad)?;
        let (c, off) = rest.split_at(split);
        let sign = if off.starts_with('-') { -1 } else { 1 };
        let mut parts = off[1..].split(':');
        let h = num(parts.next().ok_or_else(bad)?, "offset hours")?;
        let m = num(parts.next().unwrap_or("0"), "offset minutes")?;
        (c, sign * (h * 60 + m))
    };
    let mut d = date.split('-');
    let (y, mo, da) = (
        num(d.next().ok_or_else(bad)?, "year")?,
        num(d.next().ok_or_else(bad)?, "month")?,
        num(d.next().ok_or_else(bad)?, "day")?,
    );
    let mut c = clock.split(':');
    let h = num(c.next().ok_or_else(bad)?, "hour")?;
    let mi = num(c.next().ok_or_else(bad)?, "minute")?;
    let sec: f64 = c
        .next()
        .map(|s| s.parse().map_err(|_| bad()))
        .transpose()?
        .unwrap_or(0.0);
    let local = days_from_civil(y, mo, da) * 1440 + h * 60 + mi;
    Ok(Instant {
        utc_min: (local - offset_min) as f64 + sec / 60.0,
        offset_min,
    })
}

/// Formats absolute minutes in the given offset, rounded to the minute: `2026-11-17T09:12:00-06:00`.
pub fn format(utc_min: f64, offset_min: i64) -> String {
    let local = utc_min.round() as i64 + offset_min;
    let (y, m, d) = civil_from_days(local.div_euclid(1440));
    let mins = local.rem_euclid(1440);
    let sign = if offset_min < 0 { '-' } else { '+' };
    let off = offset_min.abs();
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:00{sign}{:02}:{:02}",
        mins / 60,
        mins % 60,
        off / 60,
        off % 60
    )
}

/// Minutes since local midnight and the local weekday (0 = Monday).
pub fn local_clock(t: Instant, utc_min: f64) -> (f64, usize) {
    let local = utc_min + t.offset_min as f64;
    let day = (local / 1440.0).floor();
    // 1970-01-01 was a Thursday (index 3).
    let weekday = ((day as i64 + 3).rem_euclid(7)) as usize;
    (local - day * 1440.0, weekday)
}

/// `"07:30"` → 450.
pub fn hhmm(s: &str) -> Result<f64, EngineError> {
    let (h, m) = s
        .split_once(':')
        .ok_or_else(|| EngineError::new("campus_invalid", format!("bad HH:MM {s}")))?;
    Ok((num(h, "hour")? * 60 + num(m, "minute")?) as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_with_offset() {
        let t = parse("2026-11-17T09:12:00-06:00").unwrap();
        assert_eq!(format(t.utc_min, t.offset_min), "2026-11-17T09:12:00-06:00");
        assert_eq!(
            format(t.utc_min + 60.0 * 15.0, t.offset_min),
            "2026-11-18T00:12:00-06:00"
        );
    }

    #[test]
    fn weekday_and_clock() {
        let t = parse("2026-11-17T09:12:00-06:00").unwrap();
        assert_eq!(local_clock(t, t.utc_min), (552.0, 1)); // Tuesday
        let sat = parse("2026-11-14T08:00:00-06:00").unwrap();
        assert_eq!(local_clock(sat, sat.utc_min).1, 5);
    }

    #[test]
    fn rejects_times_without_offset() {
        assert!(parse("2026-11-17T09:12:00").is_err());
        assert!(parse("garbage").is_err());
    }
}
