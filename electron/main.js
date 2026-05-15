import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';
import fs from 'fs';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // For simpler migration, but consider true for security in prod
      webSecurity: false // Necessary for some iframes and drag/drop local files
    },
  });

  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    // Only intercept the auto-updater zip file
    const isUpdateZip = item.getFilename().endsWith('.zip') && item.getFilename().includes('TeleShare');
    
    if (isUpdateZip) {
      // Save to temp folder without prompt
      const downloadPath = path.join(app.getPath('temp'), item.getFilename());
      item.setSavePath(downloadPath);
    } else {
      // For normal downloads (like saving media), don't intercept the save path
      // You can just return here and let Electron show the standard save dialog
      // But we still want to track progress if needed, though not strictly required
    }

    item.on('updated', (event, state) => {
      if (state === 'progressing' && !item.isPaused()) {
        const progress = Math.round((item.getReceivedBytes() / item.getTotalBytes()) * 100);
        mainWindow.webContents.send('download-progress', progress);
      }
    });

    item.once('done', (event, state) => {
      if (state === 'completed') {
        mainWindow.webContents.send('download-complete');
        
        // Custom Tauri-style auto-updater for macOS
        const isUpdateZip = item.getFilename().endsWith('.zip') && item.getFilename().includes('TeleShare');
        if (process.platform === 'darwin' && isUpdateZip) {
          const downloadPath = item.getSavePath();
          const extractPath = path.join(app.getPath('temp'), 'teleshare-update');
          
          // Ensure extract path is clean
          if (fs.existsSync(extractPath)) {
            fs.rmSync(extractPath, { recursive: true, force: true });
          }
          fs.mkdirSync(extractPath, { recursive: true });

          // Unzip the file
          exec(`unzip -o "${downloadPath}" -d "${extractPath}"`, (error) => {
            if (error) {
              console.error('Failed to unzip update', error);
              return;
            }

            // Path to the current running .app bundle
            const appPath = app.getAppPath();
            if (!appPath.includes('.app')) {
              console.error('Not running from a .app bundle, cannot update');
              return;
            }
            const currentAppPath = appPath.split('.app')[0] + '.app';
            
            // Find the extracted .app
            exec(`find "${extractPath}" -name "*.app" -maxdepth 2`, (err, stdout) => {
              if (err || !stdout) return;
              const newAppPath = stdout.trim().split('\\n')[0];
              
              if (newAppPath && currentAppPath) {
                // Create a bash script to swap the apps
                const scriptContent = `#!/bin/bash
# Wait for the app to close
sleep 2

# Remove the old app
rm -rf "${currentAppPath}"

# Move the new app into place
mv "${newAppPath}" "${currentAppPath}"

# Clear quarantine attribute so Gatekeeper doesn't complain about damaged app
xattr -cr "${currentAppPath}" || true

# Launch the new app
open "${currentAppPath}"
`;
                
                const scriptPath = path.join(app.getPath('temp'), 'teleshare-update.sh');
                fs.writeFileSync(scriptPath, scriptContent);
                fs.chmodSync(scriptPath, '755');
                
                // Spawn the script detached
                const child = spawn(scriptPath, [], {
                  detached: true,
                  stdio: 'ignore'
                });
                child.unref();
                
                // Quit current app
                app.quit();
              }
            });
          });
        } else if (isUpdateZip) {
          // If not mac or not zip, just open it (fallback)
          shell.openPath(item.getSavePath());
        }
      } else {
        mainWindow.webContents.send('download-error', state);
      }
    });
  });

  // Handle download request from renderer
  ipcMain.on('start-download', (event, url) => {
    mainWindow.webContents.downloadURL(url);
  });

  if (isDev) {
    // In dev, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In prod, load the built HTML
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

app.commandLine.appendSwitch('password-store', 'basic');
app.commandLine.appendSwitch('use-mock-keychain');

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
