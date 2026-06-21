const { app, BrowserWindow, Menu } = require('electron')
Menu.setApplicationMenu(null)

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    backgroundColor: '#090b11',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#090b11',
      symbolColor: '#ffffff',
      height: 32
    },
  })
  win.loadURL('http://localhost:5173')
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })