// googleDrive.js

// Google OAuth2 configuration
const CLIENT_ID = '117557639615-orqbtucvp36p674q9bt31ckoftt5tft4.apps.googleusercontent.com';
const API_KEY = 'AIzaSyCgRCTSe2qUungm-cVY639ZAnPAPfJeQyU';
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';



let gapiInited = false;
let gisInited = false;

export function initializeGoogleAPI() {
  return new Promise((resolve, reject) => {
    // Check if Google APIs are already loaded
    if (window.gapi && window.google) {
      gapiInited = true;
      gisInited = true;
      resolve();
      return;
    }

    let scriptsLoaded = 0;

    const checkAllLoaded = () => {
      scriptsLoaded++;
      if (scriptsLoaded === 2) {
        if (gapiInited && gisInited) {
          resolve();
        } else {
          reject(new Error('Failed to load Google APIs'));
        }
      }
    };

    // Load gapi client
    const script1 = document.createElement('script');
    script1.src = 'https://apis.google.com/js/api.js';
    script1.onload = () => {
      window.gapi.load('client', () => {
        window.gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: DISCOVERY_DOCS,
        }).then(() => {
          gapiInited = true;
          checkAllLoaded();
        }).catch(reject);
      });
    };
    script1.onerror = () => reject(new Error('Failed to load Google API client'));
    document.head.appendChild(script1);

    // Load Google Identity Services
    const script2 = document.createElement('script');
    script2.src = 'https://accounts.google.com/gsi/client';
    script2.onload = () => {
      gisInited = true;
      checkAllLoaded();
    };
    script2.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script2);
  });
}

export function signIn() {
  return new Promise((resolve, reject) => {
    if (!window.google) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.access_token);
        }
      },
    });
    tokenClient.requestAccessToken();
  });
}

export function uploadFileToDrive(file, accessToken) {
  return new Promise((resolve, reject) => {
    const metadata = {
      name: file.name,
      mimeType: file.type,
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    })
    .then(response => {
      if (!response.ok) {
        return response.text().then(text => { throw new Error(text) });
      }
      return response.json();
    })
    .then(data => {
      if (data.error) {
        reject(new Error(data.error.message));
      } else {
        resolve(`https://drive.google.com/file/d/${data.id}/view`);
      }
    })
    .catch(reject);
  });
}

// Utility function to check if user is signed in
export function isSignedIn() {
  return window.gapi && window.gapi.auth2 && window.gapi.auth2.getAuthInstance().isSignedIn.get();
}

// Function to sign out
export function signOut() {
  if (window.gapi && window.gapi.auth2) {
    const auth2 = window.gapi.auth2.getAuthInstance();
    if (auth2) {
      auth2.signOut();
    }
  }
  // Clear any stored tokens
  window.google.accounts.oauth2.revoke();
}