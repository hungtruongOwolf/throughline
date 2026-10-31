//! WASM exports: JSON string in, JSON string out (spec 7.1). No I/O, no clock, no network.

pub mod campus;
pub mod types;

use wasm_bindgen::prelude::*;

use crate::types::{EngineError, WalkingRouteRequest};

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
