import React, { useState, useEffect, memo, useCallback } from "react";
import "./SystemInfo.css";

const SystemInfo = () => {
    const [systemData, setSystemData] = useState(null);
    const [browserData, setBrowserData] = useState({});
    const [darkMode, setDarkMode] = useState(false);
    const [gpuInfo, setGpuInfo] = useState({ primary: "Đang kiểm tra...", secondary: "Đang kiểm tra..." });

    const getGPUInfo = useCallback(() => {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        const gl2 = canvas.getContext("webgl2");
        
        if (!gl) return { primary: "Không hỗ trợ WebGL", secondary: "Không xác định" };
        
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        const debugInfo2 = gl2?.getExtension("WEBGL_debug_renderer_info");
        
        return {
            primary: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "Không xác định",
            secondary: debugInfo2 ? gl2.getParameter(debugInfo2.UNMASKED_RENDERER_WEBGL) : "Không tìm thấy GPU phụ",
        };
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("http://localhost:5000/system-info");
                const data = await res.json();
                setSystemData(data);
            } catch (error) {
                console.error("Lỗi lấy thông tin:", error);
            }
        };

        fetchData();

        const initialBrowserData = {
            browser: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            language: navigator.language,
            gpu: getGPUInfo(),
            audioDevices: [],
        };
        
        setBrowserData(initialBrowserData);

        navigator.mediaDevices.enumerateDevices().then((devices) => {
            const audioDevices = devices
                .filter((device) => device.kind === "audiooutput")
                .map((device) => device.label);
            const inputDevices = devices
                .filter((device) => device.kind === "input")
                .map((device) => device.label);
            setBrowserData((prev) => ({ ...prev, audioDevices, inputDevices }));
        });

        const savedMode = localStorage.getItem("darkMode");
        if (savedMode === "enabled") {
            setDarkMode(true);
            document.documentElement.classList.add("dark-mode");
        }

        setGpuInfo(getGPUInfo());
    }, [getGPUInfo]);

    const toggleDarkMode = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        if (newMode) {
            document.documentElement.classList.add("dark-mode");
            localStorage.setItem("darkMode", "enabled");
        } else {
            document.documentElement.classList.remove("dark-mode");
            localStorage.setItem("darkMode", "disabled");
        }
    };

    if (!systemData) return (
        <div style={{ textAlign: 'center', fontSize: '20px', color: 'white' }}>
            Đang lấy dữ liệu...
        </div>
    );
    return (
        <div className="container">
            <h2 className="title">Thông tin hệ thống</h2>
            <button onClick={toggleDarkMode} className="button">
                Chuyển {darkMode ? "Sáng" : "Tối"}
            </button>
            <div className="section">
                <h3>Thông tin mạng</h3>
                <div className="grid">
                    {[
                        ["IP", systemData.ip],
                        ["IP4 Nội Bộ", systemData.networkInfo.length > 0 ? systemData.networkInfo[0].ip4 : "Không có dữ liệu"],
                        ["IP6 Nội Bộ", systemData.networkInfo.length > 0 ? systemData.networkInfo[0].ip6 : "Không có dữ liệu"],
                        ["Quốc gia", systemData.country],
                        ["Nhà mạng", systemData.isp],
                        ["Tên mạng", systemData.networkInfo.map(info => info.ifaceName).join(", ")],
                        ["Tốc độ mạng", systemData.networkSpeed || "Không đo được"],

                    ].map(([title, value]) => (
                        <div key={title} className="info-box">
                            <strong>{title}:</strong> {value}
                        </div>
                    ))}
                </div>
            </div>
            <div className="section">
                <h3>Thông tin hệ thống</h3>
                <div className="grid">
                    {[
                        ["Tên máy", systemData.hostname],
                        ["Serial Number", systemData.serialNumber],
                        ["UUID", systemData.uuid],
                        ["Model máy", systemData.model],
                        ["Hệ điều hành", systemData.os],
                        ["CPU", systemData.cpu],
                        ["GPU", `${gpuInfo.primary}` ,"-", `${gpuInfo.secondary}`],
                        ["RAM", systemData.ram],
                        ["Tốc độ RAM", systemData.ramSpeed],
                        ["Địa chỉ MAC", systemData.mac],
                        ["Độ phân giải", browserData.screenResolution],
                        ["Trạng thái pin", systemData.batteryStatus.percent],
                        ["Chế độ sạc", systemData.batteryStatus.isCharging ? "Đang sạc" : "Không sạc"],
                        ["Phần mềm chống virrus", systemData.antivirusSoftware],
                        ["Trạng thái tường lửa", systemData.firewallStatus.map(info => `${info.name}: ${info.enabled ? "Bật" : "Tắt"}`).join(", ")],                    ].map(([title, value]) => (
                        <div key={title} className="info-box">
                            <strong>{title}:</strong> {value}
                        </div>
                    ))}
                </div>
            </div>
            <div className="section">
                <h3>Thông tin BIOS</h3>
                <div className="grid">
                    {[
                        ["Nhà cung cấp BIOS", systemData.bios.vendor],
                        ["Phiên bản BIOS", systemData.bios.version],
                        ["Ngày phát hành BIOS", systemData.bios.releaseDate],
                    ].map(([title, value]) => (
                        <div key={title} className="info-box">
                            <strong>{title}:</strong> {value}
                        </div>
                    ))}
                </div>
            </div>

            <div className="section">
                <h3>Thông tin trình duyệt</h3>
                <div className="grid">
                    {[
                        ["Trình duyệt", browserData.browser],
                        ["Ngôn ngữ", browserData.language],
                        ["Tải CPU", systemData.cpuLoad],
                        ["Top 5 phần mềm chạy ngầm", systemData.topProcesses.map(info => info.name).join(", ")],
                    ].map(([title, value]) => (
                        <div key={title} className="info-box">
                            <strong>{title}:</strong> {value}
                        </div>
                    ))}
                </div>
            </div>
            <div className="section">
                <h3>Thông tin ổ cứng</h3>
                <div className="grid">
                    {[
                        ["Dung lượng ổ cứng", systemData.diskSize.map(d => `${d.device}: ${d.size}`).join(", ")],
                        ["Sử dụng ổ cứng", systemData.diskUsage.map(d => `${d.mount}: ${d.used}`).join(", ")],
                    ].map(([title, value]) => (
                        <div key={title} className="info-box">
                            <strong>{title}:</strong> {value}
                        </div>
                    ))}
                </div>
            </div>
            <div className="section">
                <h3>Thông tin khác</h3>
                <div className="grid">
                    {[
                        ["Thời gian hoạt động", systemData.uptime],
                        ["Thiết bị âm thanh", browserData.audioDevices.join(", ") || "Không tìm thấy"],
                        ["Thiết bị ngoại vi", systemData.usbDevices.map(info => info.name).join(", ")],
                        ["Vị trí", `Lat: ${systemData.geolocation.latitude}, Lng: ${systemData.geolocation.longitude}`],
                        ["Đất Nước", systemData.country],
                        ["Thời gian", systemData.currentTime],
                        ["Múi giờ", systemData.timeZone]
                    
                    ].map(([title, value]) => (
                        <div key={title} className="info-box">
                            <strong>{title}:</strong> {value}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default memo(SystemInfo);
