const express = require("express");
const os = require("os");
const cors = require("cors");
const axios = require("axios");
const si = require("systeminformation");
const { performance } = require("perf_hooks");
const { exec } = require("child_process");

const app = express();
app.use(cors());

async function getIPInfo() {
    try {
        const response = await axios.get("https://ipinfo.io/json", { timeout: 5000 });
        return response.data;
    } catch (error) {
        console.error("Lỗi lấy IP:", error.message);
        return { ip: "Không lấy được", country: "Không rõ", org: "Không rõ" };
    }
}

async function getMacAddress() {
    const networkInterfaces = os.networkInterfaces();
    for (const iface of Object.values(networkInterfaces)) {
        for (const details of iface) {
            if (!details.internal && details.mac !== "00:00:00:00:00:00") {
                return details.mac;
            }
        }
    }
    return "Không lấy được";
}

async function getNetworkSpeed() {
    const testUrl = "https://speed.cloudflare.com/__down?bytes=500000"; // 500KB file
    try {
        const startTime = performance.now();
        const response = await axios.get(testUrl, { responseType: "arraybuffer", timeout: 5000 });
        const durationSeconds = (performance.now() - startTime) / 1000;
        const speedMbps = ((response.data.byteLength * 8) / (1024 * 1024 * durationSeconds)).toFixed(2) + " Mbps";
        return speedMbps;
    } catch (error) {
        console.error("Lỗi đo tốc độ mạng:", error.message);
        return "Không đo được";
    }
}

async function getBatteryStatus() {
    try {
        const batteryInfo = await si.battery();
        return {
            isCharging: batteryInfo.isCharging,
            percent: batteryInfo.percent + "%"
        };
    } catch (error) {
        console.error("Lỗi lấy thông tin pin:", error.message);
        return { isCharging: false, percent: "Không xác định" };
    }
}

async function getLocation() {
    try {
        const response = await axios.get("https://ipinfo.io/json", { timeout: 5000 });
        return {
            latitude: response.data.loc.split(",")[0],
            longitude: response.data.loc.split(",")[1]
        };
    } catch (error) {
        console.error("Lỗi lấy vị trí:", error.message);
        return { latitude: null, longitude: null };
    }
}

async function checkAntivirusSoftware() {
    return new Promise((resolve, reject) => {
        exec('powershell -Command "Get-CimInstance -Namespace root/securitycenter2 -ClassName AntiVirusProduct | Select-Object -Property displayName"', (error, stdout, stderr) => {
            if (error) {
                console.error("Lỗi kiểm tra phần mềm chống virus:", error.message);
                return reject("Không xác định phần mềm chống virus");
            }
            if (stderr) {
                console.error("Lỗi kiểm tra phần mềm chống virus:", stderr);
                return reject("Không xác định phần mềm chống virus");
            }
            // Phân tách kết quả và trả về danh sách phần mềm chống virus
            const antivirusList = stdout.trim().split('\n').filter(line => line).map(line => line.trim());
            resolve(antivirusList.length > 0 ? antivirusList : ["Không có phần mềm chống virus nào"]);
        });
    });
}
async function getFirewallStatus() {
    return new Promise((resolve, reject) => {
        exec('powershell -Command "Get-NetFirewallProfile | Select-Object -Property Name, Enabled"', (error, stdout, stderr) => {
            if (error) {
                console.error("Lỗi kiểm tra trạng thái tường lửa:", error.message);
                return reject("Không xác định trạng thái tường lửa");
            }
            if (stderr) {
                console.error("Lỗi kiểm tra trạng thái tường lửa:", stderr);
                return reject("Không xác định trạng thái tường lửa");
            }
            const firewallStatus = stdout.trim().split('\n').map(line => {
                const [name, enabled] = line.split(/\s+/);
                return { name, enabled: enabled === "True" };
            });
            resolve(firewallStatus);
        });
    });
}

async function getCurrentTime() {
    return new Date().toLocaleString();
}

async function getTimeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}




app.get("/system-info", async (req, res) => {
    try {
        const [
            ipData, 
            macAddress, 
            speedMbps, 
            graphics = { controllers: [] }, // Default value
            memLayout = [], // Default value
            systemInfo, 
            cpuLoad, 
            disks, 
            fsInfo, 
            networkInfo, 
            lastBoot, 
            usbDevices = [], // Default value
            batteryStatus, 
            geolocation,
            antivirusSoftware,
            firewallStatus,
            currentTime,
            timeZone,
        ] = await Promise.all([
            getIPInfo(),
            getMacAddress(),
            getNetworkSpeed(),
            si.graphics(),
            si.memLayout(),
            si.system(),
            si.currentLoad(),
            si.diskLayout(),
            si.fsSize(),
            si.networkInterfaces(),
            si.time(),
            si.usb(),
            getBatteryStatus(),
            getLocation(),
            checkAntivirusSoftware() ,// Gọi hàm kiểm tra phần mềm chống virus
            getFirewallStatus(),
            getCurrentTime(),
            getTimeZone(),
        ]);

        const ramSpeed = memLayout.length > 0 ? `${memLayout[0].clockSpeed} MHz` : "Không xác định";
        const ramDetails = memLayout.map((ram, index) => ({
            id: index + 1,
            sizeGB: (ram.size / (1024 ** 3)).toFixed(2) + " GB",
            speedMHz: ram.clockSpeed + " MHz",
            type: ram.type || "Không xác định",
            manufacturer: ram.manufacturer || "Không rõ"
        }));

        const diskSize = disks.map(disk => ({
            device: disk.device,
            type: disk.type,
            size: (disk.size / (1024 ** 3)).toFixed(2) + " GB"
        }));

        const diskUsage = fsInfo.map(disk => ({
            mount: disk.mount,
            total: (disk.size / (1024 ** 3)).toFixed(2) + " GB",
            used: ((disk.used / disk.size) * 100).toFixed(2) + "%"
        }));

        const bios = await si.bios();
        const cpu = await si.cpu();
        const processes = await si.processes();
        const topProcesses = processes.list
            .sort((a, b) => b.cpu - a.cpu)
            .slice(0, 5)
            .map(proc => ({
                name: proc.name,
                cpuUsage: proc.cpu.toFixed(2) + "%",
                memoryUsage: (proc.memVsz / (1024 * 1024)).toFixed(2) + " MB"
            }));

        res.json({
            ip: ipData.ip,
            country: ipData.country,
            isp: ipData.org,
            hostname: os.hostname(),
            os: `${os.platform()} ${os.arch()}`,
            cpu: os.cpus()[0].model,
            ram: `${(os.totalmem() / (1024 ** 3)).toFixed(2)} GB`,
            ramSpeed: ramSpeed,
            mac: macAddress,
            uptime: `${(os.uptime() / 3600).toFixed(1)} giờ`,
            networkSpeed: speedMbps,
            gpus: graphics.controllers.map(g => g.model) || [],
            serialNumber: systemInfo.serial || "Không xác định",
            uuid: systemInfo.uuid || "Không xác định",
            model: systemInfo.model || "Không xác định",
            ramDetails: ramDetails,
            cpuLoad: cpuLoad.currentLoad.toFixed(2) + "%",
            diskSize: diskSize,
            diskUsage: diskUsage,
            networkInfo: networkInfo,
            lastBoot: new Date(lastBoot.uptime * 1000).toLocaleString(),
            bios: {
                vendor: bios.vendor,
                version: bios.version,
                releaseDate: bios.releaseDate
            },
            cpuInfo: {
                model: `${cpu.manufacturer} ${cpu.brand}`,
                cores: cpu.physicalCores,
                threads: cpu.cores,
                speed: `${cpu.speed} GHz`,
                voltage: cpu.voltage || "Không xác định",
            },
            topProcesses: topProcesses,
            usbDevices: usbDevices.map(device => ({
                name: device.name,
                deviceId: device.deviceId,
                busNumber: device.busNumber
            })) || [],
            batteryStatus: batteryStatus,
            geolocation: geolocation,
            antivirusSoftware: antivirusSoftware,// Trả về danh sách phần mềm chống virus
            firewallStatus: firewallStatus,
            currentTime: currentTime,
            timeZone: timeZone,
        });
    } catch (error) {
        console.error("Lỗi hệ thống:", error.message);
        res.status(500).json({ error: "Không thể lấy thông tin hệ thống" });
    }
});


const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server chạy trên cổng ${PORT}`));

