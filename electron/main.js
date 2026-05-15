import { app, BrowserWindow, ipcMain, shell, protocol, net } from 'electron';
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
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true, // Re-enabled for security
      webviewTag: true, // Necessary for embedding external webpages
      preload: path.join(__dirname, 'preload.js')
    },
  });

  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    // Only intercept the auto-updater zip file or exe file
    const filename = item.getFilename();
    const url = item.getURL();
    
    const isUpdateZip = filename.endsWith('.zip') && filename.includes('TeleShare');
    const isUpdateExe = filename.endsWith('.exe') && filename.includes('TeleShare');
    const isUpdateUrl = url.includes('github.com/nickhighland/teleshare/releases/download/');
    const isUpdate = isUpdateZip || isUpdateExe || isUpdateUrl;
    
    if (isUpdate) {
      // Save to temp folder without prompt
      const downloadPath = path.join(app.getPath('temp'), filename);
      
      // If file exists, delete it first to avoid "Interrupted" errors due to locked files
      if (fs.existsSync(downloadPath)) {
        try {
          fs.unlinkSync(downloadPath);
        } catch (e) {
          console.error('Failed to delete existing update file:', e);
        }
      }
      
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
        } else if (process.platform === 'win32' && isUpdateExe) {
          const downloadPath = item.getSavePath();
          // Spawn the NSIS installer silently
          const child = spawn(downloadPath, ['/S', '--updated'], {
            detached: true,
            stdio: 'ignore'
          });
          child.unref();
          app.quit();
        } else if (isUpdate) {
          // If not mac/win or fallback
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

  // Handle saving media files to local storage
  ipcMain.handle('save-media', async (event, buffer, ext) => {
    const mediaDir = path.join(app.getPath('userData'), 'media');
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const filePath = path.join(mediaDir, filename);
    fs.writeFileSync(filePath, Buffer.from(buffer));
    
    // Return the custom protocol URI
    return `teleshare://${filePath}`;
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

protocol.registerSchemesAsPrivileged([
  { scheme: 'teleshare', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } }
]);

app.whenReady().then(() => {
  protocol.handle('teleshare', (request) => {
    const filePath = request.url.replace('teleshare://', '');
    return net.fetch('file://' + decodeURIComponent(filePath));
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
