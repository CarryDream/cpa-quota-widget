// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(windows)]
    unsafe {
        // Avoid Explorer's path-derived taskbar group retaining the old development icon.
        let result = windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID(
            windows_sys::core::w!("com.cpa.quota.widget"),
        );
        if result < 0 {
            eprintln!("Failed to set widget application identity: {result:#x}");
        }
    }
    cpa_quota_widget_lib::run()
}
