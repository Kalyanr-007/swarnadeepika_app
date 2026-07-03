const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

const PORT = 8756;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let backendProcess = null;
let mainWindow = null;

function backendExePath() {
  // In a packaged app, backend.exe lives in resources/backend/.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "backend", "backend.exe");
  }
  // Dev fallback: run the bundled exe from ./resources if present.
  return path.join(__dirname, "resources", "backend", "backend.exe");
}

function startBackend() {
  const exe = backendExePath();
  const env = Object.assign({}, process.env, {
    SDB_PORT: String(PORT),
    SDB_DATA_DIR: app.getPath("userData"),
  });
  backendProcess = spawn(exe, [], { env, windowsHide: true });
  backendProcess.stdout.on("data", (d) => console.log(`[backend] ${d}`));
  backendProcess.stderr.on("data", (d) => console.error(`[backend] ${d}`));
  backendProcess.on("error", (err) => {
    dialog.showErrorBox("Backend failed to start", String(err));
  });
}

function waitForBackend(retries = 60) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = http.get(`${BASE_URL}/api/health`, (res) => {
        if (res.statusCode === 200) return resolve();
        retry(n);
      });
      req.on("error", () => retry(n));
      req.setTimeout(1000, () => {
        req.destroy();
        retry(n);
      });
    };
    const retry = (n) => {
      if (n <= 0) return reject(new Error("Backend did not start in time"));
      setTimeout(() => attempt(n - 1), 500);
    };
    attempt(retries);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    title: "Swarna Deepika Billing",
    webPreferences: { contextIsolation: true },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(BASE_URL);
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => (mainWindow = null));
}

app.whenReady().then(async () => {
  startBackend();
  try {
    await waitForBackend();
  } catch (e) {
    dialog.showErrorBox("Startup error", String(e));
    app.quit();
    return;
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("quit", () => {
  if (backendProcess) {
    try {
      backendProcess.kill();
    } catch (_) {}
  }
});
