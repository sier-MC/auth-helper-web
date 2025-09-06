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
        // CAMBIO: Recuperamos el deviceId del parámetro 'state'
        const deviceId = queryParams.state;
        const serverAuthCode = queryParams.code;

        if (!deviceId) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: "<h1>Error</h1><p>No se encontró el ID del dispositivo (state). El proceso no puede continuar.</p>"
            };
        }

        try {
            // PASO 1: Intercambiar el código por un Access Token con Google
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

            // PASO 2: Usar el Access Token para hacer login en PlayFab
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

            // --- NUEVO PASO 3: Vincular el deviceId a la cuenta ---
            console.log(`Vinculando deviceId (${deviceId}) a la cuenta ${playFabId}...`);
            const linkRequest = {
                SessionTicket: sessionTicket,
                CustomId: deviceId,
                ForceLink: true // Si el deviceId ya está vinculado a otra cuenta, lo fuerza a esta
            };

            await new Promise((resolve, reject) => {
                PlayFab.PlayFabClient.LinkCustomID(linkRequest, (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                });
            });
            console.log("¡Éxito! DeviceId vinculado correctamente.");
            
            // PASO 4: Devolver una página de éxito
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
    // CAMBIO: Necesitamos el deviceId de nuevo
    const deviceId = queryParams ? queryParams.deviceId : null;
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
    // CAMBIO: Añadimos el deviceId como 'state'
    authUrl.searchParams.append('state', deviceId);
    
    return {
        statusCode: 302, // Redirección
        headers: { "Location": authUrl.toString() }
    };
};
