// ====== 設定済み項目 ======
const WEATHER_API_KEY = "6569f9193b1871a2521eeb1bb5ffc92a";
const SPOTIFY_CLIENT_ID = "25fdf849cdf44da99c0730897f152a37";
const REDIRECT_URI = "https://k225t035-collab.github.io/my-app-5-22/";
// =========================

// URL自動変換回避
const s1 = "accounts";
const s2 = "spotify";
const s3 = "com";
const s4 = "api";
const BASE_AUTH_URL = `https://${s1}.${s2}.${s3}/authorize?`;
const BASE_API_URL = `https://${s4}.${s2}.${s3}/v1`;
const BASE_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather?";

let currentTrackUris = [];     
let currentPlaylistName = "";  

// 👤 ユーザー情報取得
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

// --- 1. Spotify Login (暗号化を使わないシンプル連携に変更) ---
document.getElementById("loginBtn").addEventListener("click", () => {
    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: 'token', // ここが「token」になるのがシンプル連携の証です
        redirect_uri: REDIRECT_URI,
        scope: 'playlist-modify-public playlist-modify-private'
    });
    // Spotifyの認証ページへ直接飛ばす
    window.location.href = BASE_AUTH_URL + params.toString(); 
});

// --- 2. Token Exchange (URLのハッシュから直接トークンを受け取る) ---
// 戻ってきたURL（#access_token=...）から情報を抜き出します
const hash = window.location.hash.substring(1);
const urlParams = new URLSearchParams(hash);
const accessToken = urlParams.get('access_token');

if (accessToken) {
    // 取得したトークンを保存
    localStorage.setItem("spotify_access_token", accessToken);
    // URLの「#access_token=...」という長い文字列を消して画面をスッキリさせる
    window.history.replaceState({}, document.title, window.location.pathname);
    location.reload(); 
}

// すでに連携済みかどうかのチェック
const savedToken = localStorage.getItem("spotify_access_token");
if (savedToken) {
    document.getElementById("loginBtn").innerText = "🔒 連携済み";
    document.getElementById("loginBtn").disabled = true;
    document.getElementById("getWeatherBtn").disabled = false;
    fetchUserProfile(savedToken);
}

// --- 核心：Recommendations APIによる選曲ロジック ---
async function searchMusic(weatherUrl) {
    const token = localStorage.getItem("spotify_access_token");
    try {
        const wRes = await fetch(weatherUrl);
        const wData = await wRes.json();
        if (wData.cod !== 200) throw new Error("都市が見つかりません");

        const weather = wData.weather[0].main;
        const temp = Math.round(wData.main.temp);
        
        let rawGenre = document.getElementById("genreSelect").value;
        let seedGenre = rawGenre === "lofi" ? "chill" : rawGenre;
        const genreLabel = document.getElementById("genreSelect").options[document.getElementById("genreSelect").selectedIndex].text;

        let targetEnergy = 0.5;       
        let targetValence = 0.5;      
        let targetAcoustic = 0.5;     

        if (weather === "Clear") {
            if (temp >= 26) { targetEnergy = 0.8; targetValence = 0.8; targetAcoustic = 0.1; }
            else if (temp >= 15) { targetEnergy = 0.6; targetValence = 0.7; targetAcoustic = 0.3; }
            else { targetEnergy = 0.4; targetValence = 0.6; targetAcoustic = 0.7; }
        } else if (weather === "Rain") {
            if (temp >= 20) { targetEnergy = 0.4; targetValence = 0.4; targetAcoustic = 0.5; }
            else { targetEnergy = 0.2; targetValence = 0.3; targetAcoustic = 0.8; }
        } else if (weather === "Clouds") {
            targetEnergy = 0.4; targetValence = 0.5; targetAcoustic = 0.5;
        } else if (weather === "Snow") {
            targetEnergy = 0.2; targetValence = 0.4; targetAcoustic = 0.9;
        }

        currentPlaylistName = `Weather: ${wData.name} (${temp}℃ / ${weather})`;
        
        const recUrl = `${BASE_API_URL}/recommendations?limit=5&seed_genres=${seedGenre}&target_energy=${targetEnergy}&target_valence=${targetValence}&target_acousticness=${targetAcoustic}`;
        
        const sRes = await fetch(recUrl, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const sData = await sRes.json();

        if (sData.error) throw new Error(`Spotifyエラー: ${sData.error.message}`);

        let html = `<h4>☁️ ${wData.name}: ${temp}℃ (${weather})</h4><p style="font-size:0.8rem; color:#1DB954;">ジャンル: ${genreLabel}</p>`;
        currentTrackUris = [];

        if (sData.tracks && sData.tracks.length > 0) {
            sData.tracks.forEach(track => {
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
            html += `<button id="playlistBtn" class="btn" style="background:#1DB954; color:white; border:none;" onclick="savePlaylist(this)">💾 プレイリストを保存</button>`;
        } else {
            html += "<p>条件に合う曲が見つかりませんでした。</p>";
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
    });
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

        btn.outerHTML = `<a href="${d1.external_urls.spotify}" target="_blank" class="btn" style="background:#1DB954; color:white; text-decoration:none; display:block; text-align:center;">✨ 成功！開く</a>`;
    } catch (e) { alert("失敗: " + e.message); btn.innerText = "❌ 失敗"; }
};
