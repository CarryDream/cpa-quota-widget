use std::collections::HashMap;
use std::time::Duration;
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_window_state::StateFlags;

#[derive(Debug, Serialize, Deserialize)]
pub struct CpaResponse {
    pub status_code: u16,
    pub headers: HashMap<String, String>,
    pub body_text: String,
}

#[tauri::command]
async fn cpa_fetch(
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    timeout_ms: Option<u64>,
) -> Result<CpaResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout_ms.unwrap_or(15000)))
        .build()
        .map_err(|e| e.to_string())?;

    let req_method = match method.to_uppercase().as_str() {
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "PATCH" => reqwest::Method::PATCH,
        _ => reqwest::Method::GET,
    };

    let mut req = client.request(req_method, &url);

    for (k, v) in headers {
        req = req.header(&k, &v);
    }

    if let Some(b) = body {
        req = req.body(b);
    }

    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status_code = resp.status().as_u16();

    let mut resp_headers = HashMap::new();
    for (k, v) in resp.headers() {
        if let Ok(v_str) = v.to_str() {
            resp_headers.insert(k.as_str().to_string(), v_str.to_string());
        }
    }

    let body_text = resp.text().await.unwrap_or_default();

    Ok(CpaResponse {
        status_code,
        headers: resp_headers,
        body_text,
    })
}

#[tauri::command]
async fn resize_window(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window
            .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn set_always_on_top(app: AppHandle, always_on_top: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_always_on_top(always_on_top).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn apply_widget_icon(app: &AppHandle, dark: bool) -> tauri::Result<()> {
    let icon = if dark {
        tauri::include_image!("icons/logo-dark.png")
    } else {
        tauri::include_image!("icons/logo-light.png")
    };
    if let Some(window) = app.get_webview_window("main") {
        window.set_icon(icon.clone())?;
        #[cfg(windows)]
        {
            let hwnd = window.hwnd()?.0 as usize;
            window.run_on_main_thread(move || unsafe {
                use windows_sys::Win32::UI::WindowsAndMessaging::{
                    SendMessageW, ICON_BIG, ICON_SMALL, WM_GETICON, WM_SETICON,
                };
                let hwnd = hwnd as *mut _;
                // Tauri updates ICON_SMALL only. Reuse its owned handle for the taskbar.
                let icon = SendMessageW(hwnd, WM_GETICON, ICON_SMALL as usize, 0);
                if icon != 0 {
                    SendMessageW(hwnd, WM_SETICON, ICON_BIG as usize, icon);
                }
            })?;
        }
    }
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_icon(Some(icon))?;
    }
    Ok(())
}

#[tauri::command]
fn set_widget_theme(app: AppHandle, dark: bool) -> Result<(), String> {
    apply_widget_icon(&app, dark).map_err(|error| error.to_string())
}

#[cfg(windows)]
const SNAP_SUBCLASS_ID: usize = 0x534E_4150;
#[cfg(windows)]
const SNAP_DISTANCE_SCREEN: i32 = 14;
#[cfg(windows)]
const SNAP_DISTANCE_WINDOW: i32 = 8;

#[cfg(windows)]
#[derive(Default)]
struct SnapState {
    cached_work_area: Option<windows_sys::Win32::Foundation::RECT>,
    cached_windows: Vec<windows_sys::Win32::Foundation::RECT>,
}

#[cfg(windows)]
unsafe extern "system" fn subclass_snap_proc(
    hwnd: windows_sys::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows_sys::Win32::Foundation::WPARAM,
    lparam: windows_sys::Win32::Foundation::LPARAM,
    _uid: usize,
    data: usize,
) -> windows_sys::Win32::Foundation::LRESULT {
    use windows_sys::core::BOOL;
    use windows_sys::Win32::Foundation::{HWND, LPARAM, RECT};
    use windows_sys::Win32::Graphics::Dwm::{
        DwmGetWindowAttribute, DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS,
    };
    use windows_sys::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };
    use windows_sys::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowLongW, GetWindowRect, GetWindowTextLengthW, IsIconic, IsWindowVisible,
        GWL_EXSTYLE, WM_ENTERSIZEMOVE, WM_EXITSIZEMOVE, WM_MOVING, WM_NCDESTROY, WS_EX_TOOLWINDOW,
    };

    match msg {
        WM_ENTERSIZEMOVE => {
            if data != 0 {
                let state = &mut *(data as *mut SnapState);
                state.cached_windows.clear();

                // 1. Cache monitor work area once (0 GDI calls during drag loop)
                let mut mi: MONITORINFO = std::mem::zeroed();
                mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
                let hmonitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
                if !hmonitor.is_null() && GetMonitorInfoW(hmonitor, &mut mi) != 0 {
                    state.cached_work_area = Some(mi.rcWork);
                } else {
                    state.cached_work_area = None;
                }

                // 2. Cache candidate application windows once
                struct EnumContext {
                    self_hwnd: HWND,
                    screen_w: i32,
                    screen_h: i32,
                    targets: Vec<RECT>,
                }

                let (screen_w, screen_h) = state
                    .cached_work_area
                    .map(|w| (w.right - w.left, w.bottom - w.top))
                    .unwrap_or((1920, 1080));

                unsafe extern "system" fn enum_candidate_windows(
                    other_hwnd: HWND,
                    lparam: LPARAM,
                ) -> BOOL {
                    let ctx = &mut *(lparam as *mut EnumContext);
                    if other_hwnd == ctx.self_hwnd {
                        return 1;
                    }
                    if IsWindowVisible(other_hwnd) == 0 || IsIconic(other_hwnd) != 0 {
                        return 1;
                    }

                    // Filter out tool windows
                    let ex_style = GetWindowLongW(other_hwnd, GWL_EXSTYLE) as u32;
                    if (ex_style & WS_EX_TOOLWINDOW) != 0 {
                        return 1;
                    }

                    // Filter out empty title windows (background helpers / invisible overlays)
                    if GetWindowTextLengthW(other_hwnd) == 0 {
                        return 1;
                    }

                    // Filter out cloaked windows (virtual desktop background / UWP background)
                    let mut cloaked: i32 = 0;
                    let hr = DwmGetWindowAttribute(
                        other_hwnd,
                        DWMWA_CLOAKED as u32,
                        &mut cloaked as *mut _ as *mut _,
                        std::mem::size_of::<i32>() as u32,
                    );
                    if hr == 0 && cloaked != 0 {
                        return 1;
                    }

                    let mut rect: RECT = std::mem::zeroed();
                    let hr = DwmGetWindowAttribute(
                        other_hwnd,
                        DWMWA_EXTENDED_FRAME_BOUNDS as u32,
                        &mut rect as *mut _ as *mut _,
                        std::mem::size_of::<RECT>() as u32,
                    );
                    if hr != 0 {
                        GetWindowRect(other_hwnd, &mut rect);
                    }

                    let w = rect.right - rect.left;
                    let h = rect.bottom - rect.top;

                    // Filter out fullscreen / desktop-sized windows and tiny windows
                    if w > 100 && h > 100 && (w < ctx.screen_w - 40 || h < ctx.screen_h - 40) {
                        ctx.targets.push(rect);
                    }
                    1
                }

                let mut ctx = EnumContext {
                    self_hwnd: hwnd,
                    screen_w,
                    screen_h,
                    targets: Vec::with_capacity(16),
                };
                let _ = EnumWindows(Some(enum_candidate_windows), &mut ctx as *mut _ as LPARAM);
                state.cached_windows = ctx.targets;
            }
            DefSubclassProc(hwnd, msg, wparam, lparam)
        }
        WM_MOVING => {
            if lparam != 0 && data != 0 {
                let rect = &mut *(lparam as *mut RECT);
                let w = rect.right - rect.left;
                let h = rect.bottom - rect.top;
                let state = &*(data as *const SnapState);

                let mut snapped_x = false;
                let mut snapped_y = false;

                // 1. Magnetic dock to screen edges (screen borders & taskbar boundary)
                if let Some(work) = state.cached_work_area {
                    if (rect.left - work.left).abs() <= SNAP_DISTANCE_SCREEN {
                        rect.left = work.left;
                        rect.right = work.left + w;
                        snapped_x = true;
                    } else if (rect.right - work.right).abs() <= SNAP_DISTANCE_SCREEN {
                        rect.right = work.right;
                        rect.left = work.right - w;
                        snapped_x = true;
                    }

                    if (rect.top - work.top).abs() <= SNAP_DISTANCE_SCREEN {
                        rect.top = work.top;
                        rect.bottom = work.top + h;
                        snapped_y = true;
                    } else if (rect.bottom - work.bottom).abs() <= SNAP_DISTANCE_SCREEN {
                        rect.bottom = work.bottom;
                        rect.top = work.bottom - h;
                        snapped_y = true;
                    }
                }

                // 2. Magnetic dock to other windows (border-to-border only)
                for other in &state.cached_windows {
                    if !snapped_x && !(rect.bottom < other.top || rect.top > other.bottom) {
                        if (rect.left - other.right).abs() <= SNAP_DISTANCE_WINDOW {
                            rect.left = other.right;
                            rect.right = rect.left + w;
                            snapped_x = true;
                        } else if (rect.right - other.left).abs() <= SNAP_DISTANCE_WINDOW {
                            rect.right = other.left;
                            rect.left = rect.right - w;
                            snapped_x = true;
                        }
                    }

                    if !snapped_y && !(rect.right < other.left || rect.left > other.right) {
                        if (rect.top - other.bottom).abs() <= SNAP_DISTANCE_WINDOW {
                            rect.top = other.bottom;
                            rect.bottom = rect.top + h;
                            snapped_y = true;
                        } else if (rect.bottom - other.top).abs() <= SNAP_DISTANCE_WINDOW {
                            rect.bottom = other.top;
                            rect.top = rect.bottom - h;
                            snapped_y = true;
                        }
                    }

                    if snapped_x && snapped_y {
                        break;
                    }
                }
            }
            // Always pass the updated position through DefSubclassProc to keep Tauri & WebView2 in sync!
            DefSubclassProc(hwnd, msg, wparam, lparam)
        }
        WM_EXITSIZEMOVE => {
            if data != 0 {
                let state = &mut *(data as *mut SnapState);
                state.cached_windows.clear();
                state.cached_work_area = None;
            }
            DefSubclassProc(hwnd, msg, wparam, lparam)
        }
        WM_NCDESTROY => {
            let _ = RemoveWindowSubclass(hwnd, Some(subclass_snap_proc), SNAP_SUBCLASS_ID);
            if data != 0 {
                let _ = Box::from_raw(data as *mut SnapState);
            }
            DefSubclassProc(hwnd, msg, wparam, lparam)
        }
        _ => DefSubclassProc(hwnd, msg, wparam, lparam),
    }
}

#[cfg(windows)]
fn attach_window_snapping(window: &tauri::WebviewWindow) {
    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            use windows_sys::Win32::UI::Shell::SetWindowSubclass;
            let hwnd = hwnd.0 as *mut _;
            let data = Box::into_raw(Box::new(SnapState::default())) as usize;
            let _ = SetWindowSubclass(hwnd, Some(subclass_snap_proc), SNAP_SUBCLASS_ID, data);
        }
    }
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::POSITION)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            cpa_fetch,
            resize_window,
            set_always_on_top,
            set_widget_theme
        ])
        .setup(|app| {
            // Build Tray Menu
            let settings_item = MenuItem::with_id(app, "settings", "⚙️ 配置 CPA 连接...", true, None::<&str>)?;
            let refresh_item = MenuItem::with_id(app, "refresh", "🔄 立即刷新额度", true, None::<&str>)?;
            let pin_item = MenuItem::with_id(app, "pin", "📌 切换窗口置顶", true, None::<&str>)?;
            let toggle_item = MenuItem::with_id(app, "toggle", "👁️ 显示 / 隐藏小组件", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "❌ 退出", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[
                &settings_item,
                &refresh_item,
                &pin_item,
                &toggle_item,
                &quit_item,
            ])?;

            let _tray = TrayIconBuilder::with_id("main")
                .icon(tauri::include_image!("icons/logo-light.png"))
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .tooltip("CPA 额度悬浮卡片")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("open-settings", ());
                        }
                    }
                    "refresh" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("trigger-refresh", ());
                        }
                    }
                    "pin" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("toggle-pin", ());
                        }
                    }
                    "toggle" => {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            #[cfg(windows)]
            if let Some(window) = app.get_webview_window("main") {
                attach_window_snapping(&window);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
