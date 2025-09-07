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
                body: "<h1>Error</h1><p>No se encontró el ID del dispositivo o la plataforma (state).</p>"
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

            // PASO C: Vincular el deviceId a la cuenta
            console.log(`Vinculando deviceId (${deviceId}) en plataforma (${platform}) a la cuenta ${playFabId}...`);
            
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
            console.log("¡Éxito! DeviceId vinculado correctamente.");
            
            // PASO D: Devolver la página de éxito personalizada con tu banner
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: `
                    <!DOCTYPE html>
                    <html lang="es">
                    <head>
                        <meta charset="UTF-8">
                        <title>¡Conexión Exitosa!</title>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap');
                            body {
                                font-family: 'Poppins', sans-serif;
                                background-color: #1a202c;
                                color: #e2e8f0;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                height: 100vh;
                                margin: 0;
                                text-align: center;
                            }
                            .container {
                                background-color: #2d3748;
                                padding: 2rem 3rem;
                                border-radius: 15px;
                                box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                                max-width: 400px;
                            }
                            .logo {
                                max-width: 250px; /* Ajusta el tamaño si es necesario */
                                margin-bottom: 1.5rem;
                                border-radius: 8px; /* Opcional: para redondear las esquinas del banner */
                            }
                            h1 {
                                color: #48bb78;
                                font-weight: 600;
                                font-size: 1.75rem;
                            }
                            p {
                                font-size: 1rem;
                                color: #a0aec0;
                            }
                            .close-btn {
                                background-color: #4299e1;
                                color: white;
                                border: none;
                                padding: 12px 24px;
                                border-radius: 8px;
                                font-size: 1rem;
                                font-weight: 600;
                                cursor: pointer;
                                margin-top: 1.5rem;
                                transition: background-color 0.3s;
                            }
                            .close-btn:hover {
                                background-color: #3182ce;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <img src="https://images.squarespace-cdn.com/content/v1/6722596d6d102f527f601083/89246877-f53e-4439-8162-a5d2dbd58a7d/Starships%26Puzzles+Banner?format=2500w" alt="Banner del Juego" class="logo">
                            <h1>¡Todo Listo!</h1>
                            <p>Tu cuenta ha sido conectada correctamente. Ya puedes volver al juego.</p>
                            <button class="close-btn" onclick="window.close()">Cerrar Ventana</button>
                        </div>
                        <script>
                            setTimeout(() => { window.close(); }, 4000);
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
                body: `<h1>Error</h1><p>Ocurrió un problema en el servidor: ${JSON.stringify(errorDetails)}</p>`
            };
        }
    }

    // --- Parte 1: El usuario llega desde el juego ---
    const deviceId = queryParams ? queryParams.deviceId : null;
    const platform = queryParams ? queryParams.platform : 'custom';

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
    
    const stateObject = { deviceId, platform };
    authUrl.searchParams.append('state', encodeURIComponent(JSON.stringify(stateObject)));
    
    return {
        statusCode: 302,
        headers: { "Location": authUrl.toString() }
    };
};
