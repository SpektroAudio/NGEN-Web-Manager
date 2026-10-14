default:
    @just --list

check: lint fmt-check types rust-fmt rust-lint

lint:
    npm run lint

lint-fix:
    npm run lint:fix

fmt:
    npm run fmt

fmt-check:
    npm run fmt:check

types:
    npm run types

rust-fmt:
    cargo fmt --check --manifest-path wasm/Cargo.toml

rust-lint:
    RUSTFLAGS="-Dwarnings" cargo build --manifest-path wasm/Cargo.toml
