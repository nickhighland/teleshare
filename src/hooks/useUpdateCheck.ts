import { useState, useEffect } from 'react';

// Using a type import for package.json structure
interface PackageJson {
  version: string;
}

export const useUpdateCheck = (repoOwner: string, repoName: string) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    const checkForUpdate = async () => {
      try {
        // Fetch the raw package.json from the main branch
        const response = await fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/package.json`, {
          // Add a cache-busting parameter to prevent stale cached responses
          cache: 'no-store'
        });
        
        if (!response.ok) {
          console.warn('Failed to fetch version info from GitHub');
          return;
        }

        const data: PackageJson = await response.json();
        const remoteVersion = data.version;
        // The current app version injected by Vite
        const localVersion = __APP_VERSION__;

        // Simple version comparison (assumes format x.y.z)
        if (remoteVersion && remoteVersion !== localVersion) {
          // For a more robust check, you might want to split by '.' and compare integers
          // but for this simple app, an exact match is usually sufficient.
          const localParts = localVersion.split('.').map(Number);
          const remoteParts = remoteVersion.split('.').map(Number);
          
          let isNewer = false;
          for (let i = 0; i < 3; i++) {
            if ((remoteParts[i] || 0) > (localParts[i] || 0)) {
              isNewer = true;
              break;
            } else if ((remoteParts[i] || 0) < (localParts[i] || 0)) {
              break;
            }
          }

          if (isNewer) {
            setUpdateAvailable(true);
            setLatestVersion(remoteVersion);
          }
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    };

    checkForUpdate();
  }, [repoOwner, repoName]);

  return { updateAvailable, latestVersion, currentVersion: __APP_VERSION__ };
};
