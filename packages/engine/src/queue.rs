//! Wait estimates from counts (spec 7.3, "Wait estimate"). Documented as an estimate; the UI
//! always shows where the count came from.

use crate::types::{EngineError, FuseRequest, FuseResult, QueueSource, WaitEstimate, WaitRequest};

/// Weight of the camera count when a fresh frame exists.
pub const SENSED_WEIGHT: f64 = 0.6;
/// A frame older than this many minutes is ignored and the ticket count is used alone.
pub const FRESH_FRAME_MIN: f64 = 3.0;

#[derive(Debug, Clone, Copy)]
pub struct ServiceModel {
    pub servers: u32,
    pub mean_service_min: f64,
}

/// Little's law, as the spec uses it: people ahead × mean service time / open servers.
/// When `minutes_until_close` is given the estimate never runs past closing time.
pub fn estimate_wait(model: ServiceModel, req: &WaitRequest) -> Result<WaitEstimate, EngineError> {
    let open = req.open_servers.unwrap_or(model.servers);
    if open == 0 {
        return Err(EngineError::new(
            "no_open_servers",
            "station has no open servers",
        ));
    }
    if !req.count.is_finite() || req.count < 0.0 {
        return Err(EngineError::new(
            "invalid_request",
            "count must be a non-negative number",
        ));
    }
    let mut minutes = req.count * model.mean_service_min / f64::from(open);
    if let Some(until_close) = req.minutes_until_close {
        minutes = minutes.min(until_close.max(0.0));
    }
    Ok(WaitEstimate {
        est_wait_min: round1(minutes),
        open_servers: open,
    })
}

/// EMA fusion of the camera count and the ticket count.
pub fn fuse(req: &FuseRequest) -> FuseResult {
    match (req.sensed, req.frame_age_min) {
        (Some(sensed), Some(age)) if age < FRESH_FRAME_MIN => FuseResult {
            count_fused: round1(SENSED_WEIGHT * sensed + (1.0 - SENSED_WEIGHT) * req.ticketed),
            source: QueueSource::Fused,
        },
        _ => FuseResult {
            count_fused: req.ticketed,
            source: QueueSource::Tickets,
        },
    }
}

/// One decimal place keeps JSON output stable and readable.
pub fn round1(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}

#[cfg(test)]
mod tests {
    use super::*;

    const CT: ServiceModel = ServiceModel {
        servers: 2,
        mean_service_min: 25.0,
    };

    fn wait(count: f64, open: Option<u32>, until_close: Option<f64>) -> WaitRequest {
        WaitRequest {
            station_id: "imaging_ct".into(),
            count,
            open_servers: open,
            minutes_until_close: until_close,
        }
    }

    #[test]
    fn littles_law_with_all_servers_open() {
        assert_eq!(
            estimate_wait(CT, &wait(3.0, None, None))
                .unwrap()
                .est_wait_min,
            37.5
        );
    }

    #[test]
    fn one_scanner_down_doubles_the_wait() {
        assert_eq!(
            estimate_wait(CT, &wait(3.0, Some(1), None))
                .unwrap()
                .est_wait_min,
            75.0
        );
    }

    #[test]
    fn never_past_closing_time() {
        assert_eq!(
            estimate_wait(CT, &wait(10.0, None, Some(20.0)))
                .unwrap()
                .est_wait_min,
            20.0
        );
    }

    #[test]
    fn zero_open_servers_is_an_error() {
        assert!(estimate_wait(CT, &wait(1.0, Some(0), None)).is_err());
    }

    #[test]
    fn stale_frames_fall_back_to_tickets() {
        let fresh = fuse(&FuseRequest {
            sensed: Some(10.0),
            ticketed: 5.0,
            frame_age_min: Some(1.0),
        });
        assert_eq!(fresh.count_fused, 8.0);
        let stale = fuse(&FuseRequest {
            sensed: Some(10.0),
            ticketed: 5.0,
            frame_age_min: Some(4.0),
        });
        assert_eq!(stale.count_fused, 5.0);
        assert_eq!(stale.source, QueueSource::Tickets);
    }
}
