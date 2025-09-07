const axios = require('axios');
const PlayFab = require('playfab-sdk');

// VARIABLES DE ENTORNO
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PLAYFAB_TITLE_ID = process.env.PLAYFAB_TITLE_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;

// Objeto con las traducciones
const translations = {
    es: {
        successTitle: "¡Conexión Exitosa!",
        successHeader: "¡Todo Listo!",
        successMessage: "Esta ventana intentará cerrarse en 3 segundos. Si no, puedes cerrarla manualmente y volver al juego.",
        errorHeader: "Error",
        errorMessage: "Ocurrió un problema en el servidor:",
        errorState: "El parámetro 'state' es inválido.",
        errorStateNotFound: "No se encontró el ID del dispositivo o la plataforma (state).",
        errorMissingParam: "Falta el parámetro 'deviceId' en la URL."
    },
    en: {
        successTitle: "Connection Successful!",
        successHeader: "All Set!",
        successMessage: "This window will try to close automatically in 3 seconds. If it doesn't, you can close it manually and return to the game.",
        errorHeader: "Error",
        errorMessage: "A problem occurred on the server:",
        errorState: "The 'state' parameter is invalid.",
        errorStateNotFound: "Device ID or platform not found (state).",
        errorMissingParam: "Missing 'deviceId' parameter in the URL."
    }
};

exports.handler = async function(event) {
    // --- LÍNEA DE DEPURACIÓN AÑADIDA ---
    console.log("DEBUG: Cabeceras recibidas:", event.headers);
    // ------------------------------------

    const queryParams = event.queryStringParameters;
    
    // Detectar idioma del navegador (default a inglés)
    const lang = event.headers['accept-language']?.startsWith('es') ? 'es' : 'en';
    const t = { ...translations.en, ...translations[lang] };

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
                            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap');
                            body { font-family: 'Poppins', sans-serif; background-color: #1a202c; color: #e2e8f0; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; padding: 1rem; }
                            .container { background-color: #2d3748; padding: 2rem 3rem; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); max-width: 450px; }
                            .logo { max-width: 250px; margin-bottom: 1.5rem; border-radius: 8px; }
                            h1 { color: #48bb78; font-weight: 700; font-size: 2.2rem; margin-top: 0; margin-bottom: 1rem; }
                            p { font-size: 1.2rem; color: #a0aec0; line-height: 1.6; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <img src="https://images.squarespace-cdn.com/content/v1/6722596d6d102f527f601083/89246877-f53e-4439-8162-a5d2dbd58a7d/Starships%26Puzzles+Banner?format=2500w" alt="Banner del Juego" class="logo">
                            <h1>${t.successHeader}</h1>
                            <p>${t.successMessage}</p>
                        </div>
                        <script>
                            setTimeout(() => {
                                window.close();
                            }, 3000);
                        </script>
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
