// ====== 設定済み項目 ======
const WEATHER_API_KEY = "6569f9193b1871a2521eeb1bb5ffc92a";
const SPOTIFY_CLIENT_ID = "25fdf849cdf44da99c0730897f152a37";
const REDIRECT_URI = "https://k225t035-collab.github.io/my-app-5-22/";
// =========================

const BASE_AUTH_URL = "https://accounts.spotify.com/authorize?";
const BASE_TOKEN_URL = "https://accounts.spotify.com/api/token";
const BASE_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather?";
const BASE_API_URL = "https://api.spotify.com/v1";

let currentTrackUris = [];     
let currentPlaylistName = "";  

// --- 便利ツール ---
function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function fetchUserProfile(accessToken) {
    try {
        const response = await fetch(`${BASE_API_URL}/me`, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        if (!response.ok) return;
        const data = await response.json();
        const profileDiv = document.getElementById("userProfile");
        profileDiv.innerText = `👤 ログイン中: ${data.display_name}`;
        profileDiv.style.display = "block"; 
    } catch (e) { console.error(e); }
}

// --- 1. Spotify Login ---
document.getElementById("loginBtn").addEventListener("click", async () => {
    const verifier = generateRandomString(128);
    localStorage.setItem("spotify_verifier", verifier);
    const challenge = await generateCodeChallenge(verifier);

    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: 'playlist-modify-public playlist-modify-private', 
        code_challenge_method: 'S256',
        code_challenge: challenge,
        show_dialog: 'true' 
    });
    window.location.href = BASE_AUTH_URL + params.toString(); 
});

// --- 2. Token Exchange ---
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

if (code) {
    const verifier = localStorage.getItem("spotify_verifier");
    const body = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier
    });

    fetch(BASE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
    })
    .then(r => r.json())
    .then(data => {
        if (data.access_token) {
            localStorage.setItem("spotify_access_token", data.access_token);
            window.history.replaceState({}, document.title, window.location.pathname);
            location.reload(); 
        }
    });
}

const savedToken = localStorage.getItem("spotify_access_token");
if (savedToken) {
    document.getElementById("loginBtn").innerText = "🔒 連携済み";
    document.getElementById("loginBtn").disabled = true;
    document.getElementById("getWeatherBtn").disabled = false;
    fetchUserProfile(savedToken);
}

// --- 核心：検索と表示 ---
async function searchMusic(weatherUrl) {
    const accessToken = localStorage.getItem("spotify_access_token");
    try {
        const wRes = await fetch(weatherUrl);
        const wData = await wRes.json();
        if (wData.cod !== 200) throw new Error("都市が見つかりません");

        const weather = wData.weather[0].main;
        const temp = Math.round(wData.main.temp);
        const genre = document.getElementById("genreSelect").value;
        const genreLabel = document.getElementById("genreSelect").options[document.getElementById("genreSelect").selectedIndex].text;

        // 🌟 気温と天気によるムード判定
        let mood = "vibe";
        if (weather === "Clear") {
            if (temp >= 26) mood = "summer upbeat energetic";
            else if (temp >= 15) mood = "happy drive breeze";
            else mood = "acoustic chill relaxing";
        } else if (weather === "Rain") {
            mood = temp >= 20 ? "mellow rain" : "rainy day jazz piano";
        } else if (weather === "Clouds") {
            mood = "lofi ambient chill";
        }

        currentPlaylistName = `Weather: ${wData.name} (${temp}℃ / ${weather})`;
        const q = `genre:${genre} ${mood}`;

        const sRes = await fetch(`${BASE_API_URL}/search?q=${encodeURIComponent(q)}&type=track&limit=5`, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        const sData = await sRes.json();

        let html = `<h4>☁️ ${wData.name}: ${temp}℃ (${weather})</h4><p style="font-size:0.8rem; color:#1DB954;">ジャンル: ${genreLabel}</p>`;
        currentTrackUris = [];

        sData.tracks.items.forEach(track => {
            currentTrackUris.push(track.uri);
            html += `
                <div style="display:flex; align-items:center; margin-bottom:12px; background:rgba(0,0,0,0.2); padding:10px; border-radius:10px;">
                    <img src="${track.album.images[0].url}" style="width:50px; border-radius:5px; margin-right:12px;">
                    <div style="flex-grow:1; overflow:hidden;">
                        <div style="font-weight:bold; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${track.name}</div>
                        <div style="font-size:0.8rem; color:#aaa;">${track.artists[0].name}</div>
                        <a href="${track.external_urls.spotify}" target="_blank" style="color:#1DB954; font-size:0.75rem; text-decoration:none;">▶︎ フル再生</a>
                    </div>
                </div>
            `;
        });

        html += `<button id="playlistBtn" class="btn" style="background:#1DB954; color:white;" onclick="savePlaylist(this)">💾 プレイリストを保存</button>`;
        document.getElementById("result").innerHTML = html;

    } catch (e) { alert(e.message); }
}

// --- ボタン操作 ---
document.getElementById("getWeatherBtn").addEventListener("click", () => {
    const city = document.getElementById("cityInput").value || "Kyoto";
    searchMusic(`${BASE_WEATHER_URL}q=${city}&appid=${WEATHER_API_KEY}&units=metric`);
});

document.getElementById("gpsBtn").addEventListener("click", () => {
    navigator.geolocation.getCurrentPosition(p => {
        searchMusic(`${BASE_WEATHER_URL}lat=${p.coords.latitude}&lon=${p.coords.longitude}&appid=${WEATHER_API_KEY}&units=metric`);
    });
});

document.getElementById("clearBtn").addEventListener("click", () => {
    localStorage.clear();
    location.reload();
});

// --- 保存機能（2026年最新API） ---
window.savePlaylist = async function(btn) {
    const token = localStorage.getItem("spotify_access_token");
    btn.innerText = "⏳ 保存中...";
    try {
        // 1. 作成（最新エンドポイント）
        const r1 = await fetch(`${BASE_API_URL}/me/playlists`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: currentPlaylistName, public: false })
        });
        const d1 = await r1.json();

        // 2. 追加（最新エンドポイント）
        await fetch(`${BASE_API_URL}/playlists/${d1.id}/items`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ uris: currentTrackUris })
        });

        btn.outerHTML = `<a href="${d1.external_urls.spotify}" target="_blank" class="btn" style="background:#1DB954; color:white; text-decoration:none;">✨ 成功！開く</a>`;
    } catch (e) { alert("失敗: " + e.message); btn.innerText = "❌ 失敗"; }
};
