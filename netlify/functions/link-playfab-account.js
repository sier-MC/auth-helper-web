const axios = require('axios');
const PlayFab = require('playfab-sdk');

// ... (El objeto 'translations' se queda igual)
const translations = {
    es: { /* ... */ },
    en: { /* ... */ }
};

exports.handler = async function(event) {
    // --- LÍNEA DE DEPURACIÓN AÑADIDA ---
    console.log("DEBUG: Cabeceras recibidas:", event.headers);
    // ------------------------------------

    const queryParams = event.queryStringParameters;
    
    const lang = event.headers['accept-language']?.startsWith('es') ? 'es' : 'en';
    const t = { ...translations.en, ...translations['es'] }; // (He mantenido tu objeto de traducciones)

    // ... (El resto del código es exactamente el mismo que en la versión anterior)
    
    // --- Parte 2: Google nos devuelve con un código y el 'state' ---
    if (queryParams && queryParams.code) {
        let stateData;
        try {
            stateData = JSON.parse(decodeURIComponent(queryParams.state));
        } catch (e) {
            return { statusCode: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: `<h1>${t.errorHeader}</h1><p>${t.errorState}</p>` };
        }
        
        const { deviceId, platform } = stateData;
        const serverAuthCode = queryParams.code;

        if (!deviceId || !platform) {
            return { statusCode: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: `<h1>${t.errorHeader}</h1><p>${t.errorStateNotFound}</p>` };
        }

        try {
            const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', null, {
                params: { code: serverAuthCode, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' }
            });
            const accessToken = tokenResponse.data.access_token;

            PlayFab.PlayFabClient.settings.titleId = PLAYFAB_TITLE_ID;
            const loginRequest = { TitleId: PLAYFAB_TITLE_ID, AccessToken: accessToken, CreateAccount: true };
            const playfabResponse = await new Promise((resolve, reject) => {
                PlayFab.PlayFabClient.LoginWithGoogleAccount(loginRequest, (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                });
            });

            const sessionTicket = playfabResponse.data.SessionTicket;
            const playFabId = playfabResponse.data.PlayFabId;

            let linkRequest = { SessionTicket: sessionTicket, ForceLink: true };
            let linkApiCall;
            if (platform === 'android') {
                linkRequest.AndroidDeviceId = deviceId;
                linkApiCall = PlayFab.PlayFabClient.LinkAndroidDeviceID;
            } else if (platform === 'ios') {
                linkRequest.IOSDeviceId = deviceId;
                linkApiCall = PlayFab.PlayFabClient.LinkIOSDeviceID;
            } else {
                linkRequest.CustomId = deviceId;
                linkApiCall = PlayFab.PlayFabClient.LinkCustomID;
            }
            await new Promise((resolve, reject) => {
                linkApiCall(linkRequest, (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                });
            });
            
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: `
                    <!DOCTYPE html>
                    <html lang="${lang}">
                    <head>
                        <meta charset="UTF-8">
                        <title>${t.successTitle}</title>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>
                            /* ... (CSS igual que antes) ... */
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <img src="https://images.squarespace-cdn.com/content/v1/6722596d6d102f527f601083/89246877-f53e-4439-8162-a5d2dbd58a7d/Starships%26Puzzles+Banner?format=2500w" alt="Banner del Juego" class="logo">
                            <h1>${t.successHeader}</h1>
                            <p>${t.successMessage}</p>
                        </div>
                    </body>
                    </html>
                `
            };

        } catch (err) {
            const errorDetails = err.response ? err.response.data : (err.errorMessage || err.message);
            console.error("Error en el proceso:", errorDetails);
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: `<h1>${t.errorHeader}</h1><p>${t.errorMessage} ${JSON.stringify(errorDetails)}</p>`
            };
        }
    }

    // --- Parte 1: El usuario llega desde el juego ---
    const deviceId = queryParams ? queryParams.deviceId : null;
    const platform = queryParams ? queryParams.platform : 'custom';

    if (!deviceId) {
        return { statusCode: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: `<h1>${t.errorHeader}</h1><p>${t.errorMissingParam}</p>` };
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'email profile');
    authUrl.searchParams.append('access_type', 'offline');
    
    const stateObject = { deviceId, platform };
    authUrl.searchParams.append('state', encodeURIComponent(JSON.stringify(stateObject)));
    
    return {
        statusCode: 302,
        headers: { "Location": authUrl.toString() }
    };
};
