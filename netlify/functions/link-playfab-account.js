const axios = require('axios');
const PlayFab = require('playfab-sdk');

// VARIABLES DE ENTORNO
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PLAYFAB_TITLE_ID = process.env.PLAYFAB_TITLE_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;

exports.handler = async function(event) {
    const queryParams = event.queryStringParameters;

    // --- Parte 2: Google nos devuelve con un código y el 'state' ---
    if (queryParams && queryParams.code) {
        // Recuperamos el deviceId Y la plataforma del parámetro 'state'
        let stateData;
        try {
            stateData = JSON.parse(decodeURIComponent(queryParams.state));
        } catch (e) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: "<h1>Error</h1><p>El parámetro 'state' es inválido.</p>"
            };
        }
        
        const { deviceId, platform } = stateData;
        const serverAuthCode = queryParams.code;

        if (!deviceId || !platform) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: "<h1>Error</h1><p>No se encontró el ID del dispositivo o la plataforma (state). El proceso no puede continuar.</p>"
            };
        }

        try {
            // PASO A: Intercambiar el código por un Access Token con Google
            console.log("Intercambiando código por token...");
            const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', null, {
                params: {
                    code: serverAuthCode,
                    client_id: GOOGLE_CLIENT_ID,
                    client_secret: GOOGLE_CLIENT_SECRET,
                    redirect_uri: REDIRECT_URI,
                    grant_type: 'authorization_code',
                }
            });
            const accessToken = tokenResponse.data.access_token;
            console.log("Token de acceso obtenido.");

            // PASO B: Usar el Access Token para hacer login/crear cuenta en PlayFab
            console.log("Iniciando sesión en PlayFab con el token de Google...");
            PlayFab.PlayFabClient.settings.titleId = PLAYFAB_TITLE_ID;

            const loginRequest = {
                TitleId: PLAYFAB_TITLE_ID,
                AccessToken: accessToken,
                CreateAccount: true
            };

            const playfabResponse = await new Promise((resolve, reject) => {
                PlayFab.PlayFabClient.LoginWithGoogleAccount(loginRequest, (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                });
            });

            const sessionTicket = playfabResponse.data.SessionTicket;
            const playFabId = playfabResponse.data.PlayFabId;
            console.log("Login con Google OK. PlayFabID:", playFabId);

            // PASO C: Vincular el deviceId a la cuenta recién creada/logueada
            console.log(`Vinculando deviceId (${deviceId}) en plataforma (${platform}) a la cuenta ${playFabId}...`);
            
            let linkRequest = { SessionTicket: sessionTicket, ForceLink: true };
            let linkApiCall;

            if (platform === 'android') {
                linkRequest.AndroidDeviceId = deviceId;
                linkApiCall = PlayFab.PlayFabClient.LinkAndroidDeviceID;
            } else if (platform === 'ios') {
                linkRequest.IOSDeviceId = deviceId; // Nota: el campo es IOSDeviceId para iOS
                linkApiCall = PlayFab.PlayFabClient.LinkIOSDeviceID;
            } else {
                // Opción por defecto si la plataforma no es android o ios
                linkRequest.CustomId = deviceId;
                linkApiCall = PlayFab.PlayFabClient.LinkCustomID;
            }

            await new Promise((resolve, reject) => {
                linkApiCall(linkRequest, (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                });
            });
            console.log("¡Éxito! DeviceId vinculado correctamente.");
            
            // PASO D: Devolver una página de éxito
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: `<h1>¡Éxito Total!</h1><p>Has iniciado sesión y tu dispositivo ha sido vinculado.</p><p>PlayFabID: ${playFabId}</p><p>Ya puedes cerrar esta ventana.</p>`
            };

        } catch (err) {
            const errorDetails = err.response ? err.response.data : (err.errorMessage || err.message);
            console.error("Error en el proceso:", errorDetails);
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: `<h1>Error</h1><p>Ocurrió un problema en el servidor: ${JSON.stringify(errorDetails)}</p>`
            };
        }
    }

    // --- Parte 1: El usuario llega desde el juego ---
    const deviceId = queryParams ? queryParams.deviceId : null;
    const platform = queryParams ? queryParams.platform : 'custom'; // 'custom' como valor por defecto

    if (!deviceId) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
            body: "<h1>Error</h1><p>Falta el parámetro 'deviceId' en la URL.</p>"
        };
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'email profile');
    authUrl.searchParams.append('access_type', 'offline');
    
    // Guardamos el deviceId y la plataforma en el parámetro 'state'
    const stateObject = { deviceId, platform };
    authUrl.searchParams.append('state', encodeURIComponent(JSON.stringify(stateObject)));
    
    return {
        statusCode: 302, // Redirección
        headers: { "Location": authUrl.toString() }
    };
};
