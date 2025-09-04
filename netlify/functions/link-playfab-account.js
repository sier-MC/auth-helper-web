import fetch from "node-fetch";

export async function handler(event, context) {
  try {
    const { serverAuthCode, sessionTicket } = JSON.parse(event.body);

    if (!serverAuthCode || !sessionTicket) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing serverAuthCode or sessionTicket" }),
      };
    }

    const url = "https://10056D.playfabapi.com/Client/LinkGoogleAccount";

    const body = {
      ServerAuthCode: serverAuthCode,
      ForceLink: true,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Authorization": sessionTicket, // 🔑 muy importante
      },
      body: JSON.stringify(body),
    });

    const text = await response.text(); // 👈 capturamos raw
    console.log("PlayFab raw response:", response.status, text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { parseError: true, raw: text };
    }

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: "PlayFab API call failed", data }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Server error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
