fn main() {
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=icons/logo-light.png");
    println!("cargo:rerun-if-changed=icons/logo-dark.png");
    unsafe {
        std::env::set_var("DEP_TAURI_DEV", "false");
    }

    if let Ok(out_dir_str) = std::env::var("OUT_DIR") {
        let out_dir = std::path::PathBuf::from(out_dir_str);
        if let Some(build_dir) = out_dir.parent().and_then(|p| p.parent()) {
            if let Ok(entries) = std::fs::read_dir(build_dir) {
                for entry in entries.flatten() {
                    let output_file = entry.path().join("output");
                    if output_file.is_file() {
                        let dir_name = entry.file_name().to_string_lossy().to_string();
                        let prefix = if dir_name.starts_with("tauri-plugin-opener-") {
                            "DEP_TAURI_PLUGIN_OPENER_".to_string()
                        } else if dir_name.starts_with("tauri-plugin-") {
                            let parts: Vec<&str> = dir_name.split('-').collect();
                            if parts.len() >= 3 {
                                format!("DEP_TAURI_PLUGIN_{}_", parts[2].to_uppercase().replace('-', "_"))
                            } else {
                                "DEP_TAURI_PLUGIN_".to_string()
                            }
                        } else if dir_name.starts_with("tauri-") {
                            "DEP_TAURI_".to_string()
                        } else {
                            continue;
                        };

                        if let Ok(content) = std::fs::read_to_string(&output_file) {
                            for line in content.lines() {
                                if let Some(rest) = line.strip_prefix("cargo:") {
                                    if let Some((k, v)) = rest.split_once('=') {
                                        let var_name = format!("{prefix}{}", k.replace(':', "_"));
                                        unsafe {
                                            std::env::set_var(&var_name, v);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    tauri_build::build();
}
