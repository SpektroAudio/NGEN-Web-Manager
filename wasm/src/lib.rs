//! WASM wrapper for the `ngen_nsl` library.
//!
//! Exposes decode / encode / validate plus description helpers to JavaScript

use ngen_nsl::{Commands, DataSource, DataValue, Int16, NSLScript};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// Flat JSON representation of a `DataSource`
#[derive(Serialize, Deserialize, Clone)]
struct DtoDataSource {
    #[serde(rename = "type")]
    t: String,
    /// "number" | "buffer"
    kind: String,
    value: u8,
}

/// Flat JSON  `Commands` variant
#[derive(Serialize, Deserialize, Clone)]
struct DtoCommand {
    cmd: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    x: Option<DtoDataSource>,
    #[serde(skip_serializing_if = "Option::is_none")]
    y: Option<DtoDataSource>,
    #[serde(skip_serializing_if = "Option::is_none")]
    offset: Option<u16>,
}

/// DTO to DataSource
fn dto_to_ds(dto: &DtoDataSource) -> DataSource {
    let dv = if dto.kind == "buffer" {
        DataValue::Buffer(dto.value)
    } else {
        DataValue::Number(dto.value)
    };
    match dto.t.as_str() {
        "Constant" => DataSource::Constant(dv),
        "Random" => DataSource::Random(dv),
        "StepPitch" => DataSource::StepPitch(dv),
        "StepVelocity" => DataSource::StepVelocity(dv),
        "StepLength" => DataSource::StepLength(dv),
        "StepDensity" => DataSource::StepDensity(dv),
        "MemoryBuffer" => DataSource::MemoryBuffer(dv),
        "Params" => DataSource::Params(dv),
        "Scale" => DataSource::Scale(dv),
        "FullScale" => DataSource::FullScale(dv),
        "RandomNote" => DataSource::RandomNote(dv),
        _ => DataSource::Constant(dv),
    }
}

/// DataSource to DTO
fn ds_to_dto(ds: &DataSource) -> DtoDataSource {
    let (t, dv) = match ds {
        DataSource::Constant(v) => ("Constant", v),
        DataSource::Random(v) => ("Random", v),
        DataSource::StepPitch(v) => ("StepPitch", v),
        DataSource::StepVelocity(v) => ("StepVelocity", v),
        DataSource::StepLength(v) => ("StepLength", v),
        DataSource::StepDensity(v) => ("StepDensity", v),
        DataSource::MemoryBuffer(v) => ("MemoryBuffer", v),
        DataSource::Params(v) => ("Params", v),
        DataSource::Scale(v) => ("Scale", v),
        DataSource::FullScale(v) => ("FullScale", v),
        DataSource::RandomNote(v) => ("RandomNote", v),
    };
    let (kind, value) = match dv {
        DataValue::Number(n) => ("number", *n),
        DataValue::Buffer(b) => ("buffer", *b),
    };
    DtoDataSource {
        t: t.to_string(),
        kind: kind.to_string(),
        value,
    }
}

/// Reads an optional DTO slot
fn opt_ds(slot: &Option<DtoDataSource>) -> DataSource {
    slot.as_ref().map(dto_to_ds).unwrap_or_default() // default to Constant 0
}

fn dto_to_cmd(dto: &DtoCommand) -> Commands {
    match dto.cmd.as_str() {
        "Set" => Commands::Set(opt_ds(&dto.x), opt_ds(&dto.y)),
        "Copy" => Commands::Copy(opt_ds(&dto.x), opt_ds(&dto.y)),
        "Add" => Commands::Add(opt_ds(&dto.x), opt_ds(&dto.y)),
        "Subtract" => Commands::Subtract(opt_ds(&dto.x), opt_ds(&dto.y)),
        "Multiply" => Commands::Multiply(opt_ds(&dto.x), opt_ds(&dto.y)),
        "Divide" => Commands::Divide(opt_ds(&dto.x), opt_ds(&dto.y)),
        "LoopSet" => Commands::LoopSet(opt_ds(&dto.x)),
        "Jump" => Commands::Jump(Int16::from_u16(dto.offset.unwrap_or(0))),
        "ClearTrack" => Commands::ClearTrack,
        "ClearMemory" => Commands::ClearMemory,
        "ClearAll" => Commands::ClearAll,
        "QuantizePitch" => Commands::QuantizePitch,
        "GenerateProgression" => Commands::GenerateProgression,
        "GenerateEuclidean" => Commands::GenerateEuclidean(opt_ds(&dto.x), opt_ds(&dto.y)),
        "CondE" => Commands::CondE(opt_ds(&dto.x), opt_ds(&dto.y)),
        "CondNE" => Commands::CondNE(opt_ds(&dto.x), opt_ds(&dto.y)),
        "CondGT" => Commands::CondGT(opt_ds(&dto.x), opt_ds(&dto.y)),
        "CondLT" => Commands::CondLT(opt_ds(&dto.x), opt_ds(&dto.y)),
        "CondGTE" => Commands::CondGTE(opt_ds(&dto.x), opt_ds(&dto.y)),
        "CondLTE" => Commands::CondLTE(opt_ds(&dto.x), opt_ds(&dto.y)),
        "CondEnd" => Commands::CondEnd,
        "LoopEnd" => Commands::LoopEnd,
        "End" => Commands::End,
        _ => Commands::None,
    }
}

fn cmd_to_dto(cmd: &Commands) -> DtoCommand {
    let (cmd_name, x, y, offset) = match cmd {
        Commands::Set(a, b) => ("Set", Some(a), Some(b), None),
        Commands::Copy(a, b) => ("Copy", Some(a), Some(b), None),
        Commands::Add(a, b) => ("Add", Some(a), Some(b), None),
        Commands::Subtract(a, b) => ("Subtract", Some(a), Some(b), None),
        Commands::Multiply(a, b) => ("Multiply", Some(a), Some(b), None),
        Commands::Divide(a, b) => ("Divide", Some(a), Some(b), None),
        Commands::LoopSet(a) => ("LoopSet", Some(a), None, None),
        Commands::Jump(v) => ("Jump", None, None, Some(v.get_value())),
        Commands::ClearTrack => ("ClearTrack", None, None, None),
        Commands::ClearMemory => ("ClearMemory", None, None, None),
        Commands::ClearAll => ("ClearAll", None, None, None),
        Commands::QuantizePitch => ("QuantizePitch", None, None, None),
        Commands::GenerateProgression => ("GenerateProgression", None, None, None),
        Commands::GenerateEuclidean(a, b) => ("GenerateEuclidean", Some(a), Some(b), None),
        Commands::CondE(a, b) => ("CondE", Some(a), Some(b), None),
        Commands::CondNE(a, b) => ("CondNE", Some(a), Some(b), None),
        Commands::CondGT(a, b) => ("CondGT", Some(a), Some(b), None),
        Commands::CondLT(a, b) => ("CondLT", Some(a), Some(b), None),
        Commands::CondGTE(a, b) => ("CondGTE", Some(a), Some(b), None),
        Commands::CondLTE(a, b) => ("CondLTE", Some(a), Some(b), None),
        Commands::CondEnd => ("CondEnd", None, None, None),
        Commands::LoopEnd => ("LoopEnd", None, None, None),
        Commands::End => ("End", None, None, None),
        Commands::SelectTrack | Commands::None => ("None", None, None, None),
    };
    DtoCommand {
        cmd: cmd_name.to_string(),
        x: x.map(ds_to_dto),
        y: y.map(ds_to_dto),
        offset,
    }
}

/// Error payload reported by the engine (kind + byte offset after the header)
#[derive(Serialize)]
struct DtoError {
    kind: String,
    pos: u16,
}

/// Result of a script validation
#[derive(Serialize)]
struct ValidationResult {
    valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<DtoError>,
}

// JSON to NSL Script
fn script_from_json(commands_json: &str) -> Option<NSLScript> {
    let dtos: Vec<DtoCommand> = serde_json::from_str(commands_json).ok()?;
    let mut script = NSLScript::new();
    for dto in dtos {
        script.add_command(dto_to_cmd(&dto));
    }
    Some(script)
}

// WASM Binds

#[wasm_bindgen]
pub fn decode(bytes: &[u8]) -> Option<String> {
    let script = NSLScript::from_u8_vec(bytes.to_vec())?;
    let dtos: Vec<DtoCommand> = script.commands.iter().map(cmd_to_dto).collect();
    serde_json::to_string(&dtos).ok()
}

#[wasm_bindgen]
pub fn encode(commands_json: &str) -> Option<Vec<u8>> {
    let mut script = script_from_json(commands_json)?;
    script.code().ok()
}

/// Validates a script and returns a JSON result
#[wasm_bindgen]
pub fn validate(commands_json: &str) -> String {
    let result = match script_from_json(commands_json) {
        None => ValidationResult {
            valid: false,
            error: Some(DtoError {
                kind: "InvalidJson".to_string(),
                pos: 0,
            }),
        },
        Some(script) => match script.validate() {
            Ok(()) => ValidationResult {
                valid: true,
                error: None,
            },
            Err(e) => ValidationResult {
                valid: false,
                error: Some(DtoError {
                    kind: format!("{:?}", e.kind),
                    pos: e.pos,
                }),
            },
        },
    };
    serde_json::to_string(&result).unwrap_or_else(|_| r#"{"valid":false}"#.to_string())
}

#[wasm_bindgen]
pub fn command_description(cmd_json: &str) -> Option<String> {
    let dto: DtoCommand = serde_json::from_str(cmd_json).ok()?;
    Some(dto_to_cmd(&dto).description())
}

#[wasm_bindgen]
pub fn data_source_text(ds_json: &str) -> Option<String> {
    let dto: DtoDataSource = serde_json::from_str(ds_json).ok()?;
    Some(dto_to_ds(&dto).formatted_value())
}

#[wasm_bindgen]
pub fn data_source_max(type_name: &str, kind: &str) -> Option<u8> {
    let dto = DtoDataSource {
        t: type_name.to_string(),
        kind: kind.to_string(),
        value: 0,
    };
    let ds = dto_to_ds(&dto);
    let kind_cap: u8 = if dto.kind == "buffer" { 31 } else { 127 };
    Some(ds.max().min(kind_cap))
}

/// Maximum value per destination type
#[wasm_bindgen]
pub fn data_source_dest_max(type_name: &str) -> Option<u8> {
    let dto = DtoDataSource {
        t: type_name.to_string(),
        kind: "number".to_string(),
        value: 0,
    };
    Some(dto_to_ds(&dto).dest_max())
}
