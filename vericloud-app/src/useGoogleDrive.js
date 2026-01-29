
import { gapi } from 'gapi-script';

const CLIENT_ID = '117557639615-orqbtucvp36p674q9bt31ckoftt5tft4.apps.googleusercontent.com';
const API_KEY = 'AIzaSyCgRCTSe2qUungm-cVY639ZAnPAPfJeQyU';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

export const initGAPI = () => {
  gapi.load('client:auth2', async () => {
    await gapi.client.init({
      apiKey: API_KEY,
      clientId: CLIENT_ID,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      scope: SCOPES,
    });
  });
};

export const signIn = async () => {
  const authInstance = gapi.auth2.getAuthInstance();
  await authInstance.signIn();
  return authInstance.currentUser.get().getAuthResponse().access_token;
};

export const uploadFileToDrive = async (file, accessToken) => {
  const metadata = { name: file.name, mimeType: file.type };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );
  const data = await response.json();
  return data.webViewLink; // URL to show in dashboard
};
