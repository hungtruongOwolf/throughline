//! WASM exports: JSON string in, JSON string out (spec 7.1). No I/O, no clock, no network.

pub mod campus;
pub mod itinerary;
pub mod queue;
pub mod time;
pub mod types;

use wasm_bindgen::prelude::*;

use crate::types::{
    EngineError, FuseRequest, ItineraryRequest, ReplanRequest, WaitRequest, WalkingMatrixRequest,
    WalkingRouteRequest,
};

/// Crate version, so the proof panel can say "engine: rust-wasm 0.x".
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[wasm_bindgen(js_name = campusVersion)]
pub fn campus_version() -> String {
    match campus::campus() {
        Ok(c) => c.version.clone(),
        Err(e) => e.to_json(),
    }
}

#[wasm_bindgen(js_name = walkingRoute)]
pub fn walking_route(request_json: &str) -> String {
    run(request_json, |req: WalkingRouteRequest| {
        let campus = campus::campus()?;
        campus::walking_route(campus, &req.from, &req.to, req.mobility)
    })
}

#[wasm_bindgen(js_name = walkingMatrix)]
pub fn walking_matrix(request_json: &str) -> String {
    run(request_json, |req: WalkingMatrixRequest| {
        campus::walking_matrix(campus::campus()?, &req.node_ids, req.mobility)
    })
}

#[wasm_bindgen(js_name = estimateWait)]
pub fn estimate_wait(request_json: &str) -> String {
    run(request_json, |req: WaitRequest| {
        let station = campus::campus()?.station(&req.station_id)?;
        queue::estimate_wait(station.service_model(), &req)
    })
}

#[wasm_bindgen(js_name = fuseQueue)]
pub fn fuse_queue(request_json: &str) -> String {
    run(request_json, |req: FuseRequest| Ok(queue::fuse(&req)))
}

#[wasm_bindgen(js_name = planItinerary)]
pub fn plan_itinerary(request_json: &str) -> String {
    run(request_json, |req: ItineraryRequest| {
        itinerary::plan(campus::campus()?, &req)
    })
}

#[wasm_bindgen(js_name = replanItinerary)]
pub fn replan_itinerary(request_json: &str) -> String {
    run(request_json, |req: ReplanRequest| {
        itinerary::replan(campus::campus()?, &req)
    })
}

/// Parses the request, runs `f`, and serializes either the result or an error envelope.
fn run<Req, Res, F>(request_json: &str, f: F) -> String
where
    Req: serde::de::DeserializeOwned,
    Res: serde::Serialize,
    F: FnOnce(Req) -> Result<Res, EngineError>,
{
    let result = serde_json::from_str::<Req>(request_json)
        .map_err(|e| EngineError::new("invalid_request", e.to_string()))
        .and_then(f);
    match result {
        Ok(value) => serde_json::to_string(&value)
            .unwrap_or_else(|e| EngineError::new("internal", e.to_string()).to_json()),
        Err(e) => e.to_json(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    /// JSON equality where 155 and 155.0 are the same number.
    fn json_eq(a: &Value, b: &Value) -> bool {
        match (a, b) {
            (Value::Number(x), Value::Number(y)) => x.as_f64() == y.as_f64(),
            (Value::Array(x), Value::Array(y)) => {
                x.len() == y.len() && x.iter().zip(y).all(|(p, q)| json_eq(p, q))
            }
            (Value::Object(x), Value::Object(y)) => {
                x.len() == y.len()
                    && x.iter()
                        .all(|(k, v)| y.get(k).is_some_and(|w| json_eq(v, w)))
            }
            _ => a == b,
        }
    }

    fn dispatch(function: &str, request: &str) -> String {
        match function {
            "walkingRoute" => walking_route(request),
            "walkingMatrix" => walking_matrix(request),
            "estimateWait" => estimate_wait(request),
            "fuseQueue" => fuse_queue(request),
            "planItinerary" => plan_itinerary(request),
            "replanItinerary" => replan_itinerary(request),
            other => panic!("unknown fixture function {other}"),
        }
    }

    /// Golden fixtures shared with the TypeScript wrapper tests (spec 12.1 test 19).
    #[test]
    fn golden_fixtures_match() {
        for file in [
            include_str!("../fixtures/routes.json"),
            include_str!("../fixtures/waits.json"),
            include_str!("../fixtures/itinerary.json"),
        ] {
            let fixture: Value = serde_json::from_str(file).unwrap();
            for case in fixture["cases"].as_array().unwrap() {
                let request = case["request"].to_string();
                let function = case["fn"].as_str().unwrap();
                let first = dispatch(function, &request);
                // Spec 12.1 test 17: same input, byte-identical output.
                assert_eq!(first, dispatch(function, &request), "{}", case["name"]);
                let actual: Value = serde_json::from_str(&first).unwrap();
                assert!(
                    json_eq(&actual, &case["expected"]),
                    "{}: got {actual}",
                    case["name"]
                );
            }
        }
    }

    #[test]
    fn walking_route_is_deterministic_json() {
        let req = r#"{"from":"mp1.entrance","to":"mp2.ct2","mobility":"walking"}"#;
        assert_eq!(walking_route(req), walking_route(req));
        assert!(walking_route(req).contains(r#""seconds":155.0"#));
    }

    #[test]
    fn invalid_json_returns_an_error_envelope() {
        let out = walking_route("{not json");
        assert!(out.starts_with(r#"{"error":{"code":"invalid_request""#));
    }
}
