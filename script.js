// ====== 設定済み項目 ======
const WEATHER_API_KEY = "6569f9193b1871a2521eeb1bb5ffc92a";
const SPOTIFY_CLIENT_ID = "25fdf849cdf44da99c0730897f152a37";
const REDIRECT_URI = "https://k225t035-collab.github.io/my-app-5-22/";
// =========================

const BASE_AUTH_URL = "https://accounts.spotify.com/authorize?";
const BASE_TOKEN_URL = "https://accounts.spotify.com/api/token";
const BASE_API_URL = "https://api.spotify.com/v1";
const BASE_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather?";

let currentTrackUris = [];     
let currentPlaylistName = "";  

// 🌟 世界のランダム都市リスト（気候が特徴的な都市をチョイス）
const WORLD_CITIES = [
    "London", "Paris", "New York", "Reykjavik", "Honolulu", 
    "Cairo", "Sydney", "Bangkok", "Rovaniemi", "Rio de Janeiro"
];

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

// すでに連携済みかどうかのチェック
const savedToken = localStorage.getItem("spotify_access_token");
if (savedToken) {
    document.getElementById("loginBtn").innerText = "🔒 連携済み";
    document.getElementById("loginBtn").disabled = true;
    document.getElementById("getWeatherBtn").disabled = false;
    fetchUserProfile(savedToken);
}

// --- 核心：検索と表示（お任せ天気＋時間帯ミックス版） ---
async function searchMusic(weatherUrl) {
    const accessToken = localStorage.getItem("spotify_access_token");
    if (!accessToken) {
        alert("先に「1. Spotifyと連携する」ボタンを押してください！");
        return;
    }

    try {
        const wRes = await fetch(weatherUrl);
        const wData = await wRes.json();
        if (wData.cod !== 200) throw new Error("都市が見つかりません。ローマ字で入力してください。");

        const weather = wData.weather[0].main;
        const temp = Math.round(wData.main.temp);

        // 🌟 【機能2】時間帯の自動判定（朝・昼・夕方・夜）
        const hour = new Date().getHours();
        let timeTag = "";
        let timeDisplay = "";

        if (hour >= 5 && hour < 11) {
            timeTag = "morning refreshing awake";
            timeDisplay = "🌅 朝の爽やか";
        } else if (hour >= 11 && hour < 16) {
            timeTag = "afternoon sunny bright";
            timeDisplay = "☀️ お昼の快適";
        } else if (hour >= 16 && hour < 19) {
            timeTag = "sunset twilight chill";
            timeDisplay = "🌆 夕方のエモい";
        } else {
            timeTag = "night midnight mellow sleepy";
            timeDisplay = "🌌 夜のディープ";
        }

        // 基本の天気判定
        let weatherTag = "vibe";
        if (weather === "Clear") {
            if (temp >= 26) weatherTag = "summer upbeat energetic";
            else if (temp >= 15) weatherTag = "happy drive breeze";
            else weatherTag = "acoustic chill relaxing";
        } else if (weather === "Rain") {
            weatherTag = temp >= 20 ? "mellow rain" : "rainy day jazz piano";
        } else if (weather === "Clouds") {
            weatherTag = "lofi ambient chill";
        } else if (weather === "Snow") {
            weatherTag = "ambient winter piano";
        }

        currentPlaylistName = `Weather: ${wData.name} (${temp}℃ / ${weather})`;
        
        // 🌟 天気キーワードと時間帯キーワードを合体させて検索！
        const q = `${weatherTag} ${timeTag}`;

        const sRes = await fetch(`${BASE_API_URL}/search?q=${encodeURIComponent(q)}&type=track&limit=5`, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        const sData = await sRes.json();

        // 画面に「時間帯の判定結果」もちょっとオシャレに表示
        let html = `
            <div style="text-align:center; margin-bottom: 20px;">
                <h4 style="margin: 5px 0;">☁️ ${wData.name}: ${temp}℃ (${weather})</h4>
                <span style="font-size:0.8rem; background:#444; padding:3px 8px; border-radius:20px; color:#1DB954;">${timeDisplay}モード選曲</span>
            </div>
        `;
        currentTrackUris = [];

        if (sData.tracks && sData.tracks.items.length > 0) {
            sData.tracks.items.forEach(track => {
                currentTrackUris.push(track.uri);
                html += `
                    <div style="display:flex; align-items:center; margin-bottom:12px; background:#282828; padding:10px; border-radius:10px;">
                        <img src="${track.album.images[0].url}" style="width:50px; border-radius:5px; margin-right:12px;">
                        <div style="flex-grow:1; overflow:hidden;">
                            <div style="font-weight:bold; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; font-size:0.9rem;">${track.name}</div>
                            <div style="font-size:0.8rem; color:#aaa;">${track.artists[0].name}</div>
                            <a href="${track.external_urls.spotify}" target="_blank" style="color:#1DB954; font-size:0.75rem; text-decoration:none;">▶︎ フル再生</a>
                        </div>
                    </div>
                `;
            });

            html += `<button id="playlistBtn" class="btn btn-spotify" style="margin-top: 15px;" onclick="savePlaylist(this)">💾 プレイリストを保存</button>`;
        } else {
            html += "<p style='text-align:center;'>条件に合う曲が見つかりませんでした。</p>";
        }

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
    }, () => {
        alert("位置情報の取得に失敗しました。都市名を入力して検索してください。");
    });
});

// 🌟 【機能1】世界トリップボタンの処理
document.getElementById("tripBtn").addEventListener("click", () => {
    const randomCity = WORLD_CITIES[Math.floor(Math.random() * WORLD_CITIES.length)];
    // 検索入力欄にも都市名を自動で入れてあげる（親切設計）
    document.getElementById("cityInput").value = randomCity;
    searchMusic(`${BASE_WEATHER_URL}q=${randomCity}&appid=${WEATHER_API_KEY}&units=metric`);
});

document.getElementById("clearBtn").addEventListener("click", () => {
    localStorage.clear();
    location.reload();
});

// --- 保存機能 ---
window.savePlaylist = async function(btn) {
    const token = localStorage.getItem("spotify_access_token");
    btn.innerText = "⏳ 保存中...";
    try {
        const r1 = await fetch(`${BASE_API_URL}/me/playlists`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: currentPlaylistName, public: false })
        });
        const d1 = await r1.json();

        await fetch(`${BASE_API_URL}/playlists/${d1.id}/items`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ uris: currentTrackUris })
        });

        btn.outerHTML = `<a href="${d1.external_urls.spotify}" target="_blank" class="btn btn-spotify" style="text-decoration:none; display:block;">✨ 成功！Spotifyで開く</a>`;
    } catch (e) { alert("失敗: " + e.message); btn.innerText = "❌ 失敗"; }
};
