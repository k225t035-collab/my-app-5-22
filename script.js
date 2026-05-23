// ====== CONFIG（バグ対策・強制結合版） ======
const WEATHER_API_KEY = "6569f9193b1871a2521eeb1bb5ffc92a";
const SPOTIFY_CLIENT_ID = "25fdf849cdf44da99c0730897f152a37";
const REDIRECT_URI = "https://k225t035-collab.github.io/my-app-5-22/";

// 🌟 あなたの環境で100%成功していたURL記述
const BASE_AUTH_URL = "https://" + "accounts." + "spotify.com/authorize?";
const BASE_TOKEN_URL = "https://" + "accounts." + "spotify.com/api/token";
const BASE_API_URL = "https://" + "api." + "spotify.com/v1";
const BASE_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather?";

const WORLD_CITIES = ["London", "Paris", "New York", "Reykjavik", "Honolulu", "Cairo", "Sydney", "Bangkok", "Rio de Janeiro", "Berlin"];

function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    const base64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let result = "";
    const bytes = new Uint8Array(digest);
    for (let i = 0; i < bytes.length; i += 3) {
        const b1 = bytes[i], b2 = i + 1 < bytes.length ? bytes[i + 1] : 0, b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
        const group = (b1 << 16) | (b2 << 8) | b3;
        result += base64chars[(group >> 18) & 63] + base64chars[(group >> 12) & 63];
        result += i + 1 < bytes.length ? base64chars[(group >> 6) & 63] : "";
        result += i + 2 < bytes.length ? base64chars[group & 63] : "";
    }
    return result;
}

// --- CORE LOGIC ---
async function searchMusic(weatherUrl) {
    const token = localStorage.getItem("spotify_access_token");
    const resultDiv = document.getElementById("result");
    const loader = document.getElementById("loading");

    if (resultDiv) resultDiv.innerHTML = "";
    if (loader) {
        loader.style.display = "block";
        loader.innerText = "🎵 選曲中...";
    }

    try {
        const wRes = await fetch(weatherUrl);
        const wData = await wRes.json();
        if (wData.cod !== 200) throw new Error("都市が見つかりません。念のためローマ字で入力してください");

        const weather = wData.weather[0].main;
        const temp = Math.round(wData.main.temp);
        const cityName = wData.name;

        const hour = new Date().getHours();
        let timeTag = "night mellow";
        let timeLabel = "🌌 深夜の静寂";
        if (hour >= 5 && hour < 11) { timeTag = "morning fresh energetic"; timeLabel = "🌅 朝の爽やか"; }
        else if (hour >= 11 && hour < 16) { timeTag = "afternoon sunny happy"; timeLabel = "☀️ 昼の快適"; }
        else if (hour >= 16 && hour < 19) { timeTag = "sunset twilight chill"; timeLabel = "🌆 夕方の哀愁"; }

        if (loader) loader.innerText = `🎵 ${cityName}は${weather}... ${timeLabel}モードで選曲中...`;

        let weatherTag = "chill";
        if (weather === "Clear") weatherTag = temp >= 25 ? "summer energetic" : "happy breezy";
        else if (weather === "Rain") weatherTag = "rainy jazz piano mellow";
        else if (weather === "Clouds") weatherTag = "lofi chill ambient";

        const q = `${weatherTag} ${timeTag}`;
        const sRes = await fetch(`${BASE_API_URL}/search?q=${encodeURIComponent(q)}&type=track&limit=6`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const sData = await sRes.json();

        if (loader) loader.style.display = "none";
        let html = `<div style="text-align:center; margin-bottom:15px;"><small>${cityName}: ${temp}℃ / ${weather}</small></div>`;
        
        const trackUris = [];
        if (sData && sData.tracks && sData.tracks.items) {
            sData.tracks.items.forEach(track => {
                trackUris.push(track.uri);
                html += `
                    <div class="track-card">
                        <img src="${track.album.images[0].url}" class="track-img">
                        <div style="flex-grow:1; overflow:hidden;">
                            <div style="font-weight:bold; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${track.name}</div>
                            <div style="font-size:0.8rem; color:#888;">${track.artists[0].name}</div>
                            <a href="${track.external_urls.spotify}" target="_blank" style="color:var(--spotify-green); font-size:0.7rem; text-decoration:none;">SPOTIFYで聴く</a>
                        </div>
                    </div>`;
            });
        }

        html += `<button class="btn btn-spotify" onclick='savePlaylist(this, "${cityName} Weather", ${JSON.stringify(trackUris)})'>💾 プレイリストを保存</button>`;
        if (resultDiv) resultDiv.innerHTML = html;

    } catch (e) { 
        if (loader) loader.style.display = "none";
        alert(e.message); 
    }
}

// 🌟 復活：都市チップをクリックしたときに動く関数
window.selectCity = function(cityName) {
    const cityInput = document.getElementById("cityInput");
    if (cityInput) cityInput.value = cityName;
    searchMusic(`${BASE_WEATHER_URL}q=${cityName}&appid=${WEATHER_API_KEY}&units=metric`);
};

// --- EVENTS ---
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
        const verifier = generateRandomString(128);
        localStorage.setItem("spotify_verifier", verifier);
        const challenge = await generateCodeChallenge(verifier);
        const params = new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT_URI,
            scope: 'playlist-modify-public playlist-modify-private', code_challenge_method: 'S256', code_challenge: challenge
        });
        window.location.href = BASE_AUTH_URL + params.toString();
    });
}

// TOKEN EXCHANGE
const code = new URLSearchParams(window.location.search).get('code');
if (code) {
    const verifier = localStorage.getItem("spotify_verifier");
    fetch(BASE_TOKEN_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, code_verifier: verifier })
    }).then(r => r.json()).then(data => {
        if (data.access_token) {
            localStorage.setItem("spotify_access_token", data.access_token);
            window.history.replaceState({}, document.title, window.location.pathname);
            location.reload();
        }
    }).catch(err => console.log("Token exchange error:", err));
}

const savedToken = localStorage.getItem("spotify_access_token");
if (savedToken) {
    const loginBtn = document.getElementById("loginBtn");
    const weatherAppSection = document.getElementById("weatherAppSection");
    if (loginBtn) loginBtn.style.display = "none";
    if (weatherAppSection) weatherAppSection.style.display = "block";
    
    fetch(`${BASE_API_URL}/me`, { headers: { 'Authorization': 'Bearer ' + savedToken } })
        .then(r => r.json()).then(data => {
            const profile = document.getElementById("userProfile");
            if (profile && data && data.display_name) {
                profile.innerText = `👤 Hello, ${data.display_name}`;
                profile.style.display = "block";
            }
        }).catch(err => console.log("Profile fetch error:", err));
}

// GPSボタン
const gpsBtn = document.getElementById("gpsBtn");
if (gpsBtn) {
    gpsBtn.addEventListener("click", () => {
        const loader = document.getElementById("loading");
        const resultDiv = document.getElementById("result");
        if (resultDiv) resultDiv.innerHTML = ""; 
        if (loader) {
            loader.innerText = "📍 現在地を取得中..."; 
            loader.style.display = "block";
        }

        navigator.geolocation.getCurrentPosition(p => {
            searchMusic(`${BASE_WEATHER_URL}lat=${p.coords.latitude}&lon=${p.coords.longitude}&appid=${WEATHER_API_KEY}&units=metric`);
        }, (error) => {
            if (loader) loader.style.display = "none";
            alert("位置情報の取得に失敗しました。ブラウザの位置情報許可がオンになっているか確認してください。");
        });
    });
}

// 天気取得ボタン
const getWeatherBtn = document.getElementById("getWeatherBtn");
if (getWeatherBtn) {
    getWeatherBtn.addEventListener("click", () => {
        const cityInput = document.getElementById("cityInput");
        const city = cityInput ? (cityInput.value || "Kyoto") : "Kyoto";
        searchMusic(`${BASE_WEATHER_URL}q=${city}&appid=${WEATHER_API_KEY}&units=metric`);
    });
}

// ランダムトリップボタン
const tripBtn = document.getElementById("tripBtn");
if (tripBtn) {
    tripBtn.addEventListener("click", () => {
        const city = WORLD_CITIES[Math.floor(Math.random() * WORLD_CITIES.length)];
        const cityInput = document.getElementById("cityInput");
        if (cityInput) cityInput.value = city;
        searchMusic(`${BASE_WEATHER_URL}q=${city}&appid=${WEATHER_API_KEY}&units=metric`);
    });
}

// プレイリスト保存処理
window.savePlaylist = async function(btn, name, uris) {
    const token = localStorage.getItem("spotify_access_token");
    const originalText = btn.innerText;
    btn.innerText = "⏳ 保存中...";
    
    try {
        const r1 = await fetch(`${BASE_API_URL}/me/playlists`, {
            method: 'POST', 
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, public: false })
        });
        const d1 = await r1.json();
        
        if (!r1.ok) throw new Error(d1.error ? d1.error.message : "枠の作成に失敗しました");
        
        const r2 = await fetch(`${BASE_API_URL}/playlists/${d1.id}/items`, {
            method: 'POST', 
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ uris: uris })
        });
        
        if (!r2.ok) {
            const d2 = await r2.json();
            throw new Error(d2.error ? d2.error.message : "楽曲の追加に失敗しました");
        }
        
        const spotifyUrl = d1.external_urls.spotify;
        btn.outerHTML = `<a href="${spotifyUrl}" target="_blank" class="btn btn-spotify" style="text-decoration:none; display:flex; justify-content:center; background:#1ed760; color:black;">✨ 成功！Spotifyで開く</a>`;
        window.open(spotifyUrl, '_blank');
        
    } catch (e) { 
        alert("保存失敗: " + e.message); 
        btn.innerText = originalText;
    }
};

// キャッシュクリアボタン
const clearBtn = document.getElementById("clearBtn") || document.getElementById("clear");
if (clearBtn) {
    clearBtn.addEventListener("click", () => { 
        localStorage.clear(); 
        location.reload(); 
    });
}
