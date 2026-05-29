use std::process::Command;
use std::path::Path;

fn main() {
    let frontend_dir = Path::new("frontend");
    let dist_dir = frontend_dir.join("dist");

    // Build frontend if not already built
    if !dist_dir.exists() {
        println!("cargo:warning=Frontend not built. Building frontend...");

        // Install npm dependencies
        let npm_install = Command::new("npm")
            .arg("install")
            .current_dir(frontend_dir)
            .status()
            .expect("Failed to run npm install");

        if !npm_install.success() {
            println!("cargo:warning=Frontend npm install failed. The binary will serve a placeholder page.");
            println!("cargo:warning=Run 'cd frontend && npm install && npm run build' manually.");
            return;
        }

        // Build frontend
        let npm_build = Command::new("npm")
            .arg("run")
            .arg("build")
            .current_dir(frontend_dir)
            .status()
            .expect("Failed to run npm build");

        if !npm_build.success() {
            println!("cargo:warning=Frontend build failed. The binary will serve a placeholder page.");
            println!("cargo:warning=Run 'cd frontend && npm run build' manually.");
        }
    }

    // Build WASM if not already built
    let wasm_pkg_dir = Path::new("wasm/pkg");
    if !wasm_pkg_dir.exists() {
        println!("cargo:warning=WASM package not built. Building WASM...");

        let wasm_pack = Command::new("wasm-pack")
            .arg("build")
            .arg("wasm")
            .arg("--target")
            .arg("web")
            .arg("--out-dir")
            .arg("pkg")
            .status();

        match wasm_pack {
            Ok(status) if status.success() => {
                println!("cargo:warning=WASM build successful.");
            }
            _ => {
                println!("cargo:warning=WASM build failed. Crypto will use JS fallback.");
                println!("cargo:warning=Install wasm-pack and run 'wasm-pack build wasm --target web --out-dir pkg' manually.");
            }
        }
    }

    // Tell cargo to rerun if frontend dist changes
    println!("cargo:rerun-if-changed=frontend/dist");
    println!("cargo:rerun-if-changed=wasm/pkg");
}
