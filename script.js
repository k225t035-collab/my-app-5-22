// ====== CONFIG ======
const WEATHER_API_KEY = "6569f9193b1871a2521eeb1bb5ffc92a";
const SPOTIFY_CLIENT_ID = "25fdf849cdf44da99c0730897f152a37";
const REDIRECT_URI = "https://k225t035-collab.github.io/my-app-5-22/";

const BASE_AUTH_URL = "https://accounts.spotify.com/authorize?";
const BASE_TOKEN_URL = "https://accounts.spotify.com/api/token";
const BASE_API_URL = "https://api.spotify.com/v1";
const BASE_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather?";

const WORLD_CITIES = ["London", "Paris", "New York", "Reykjavik", "Honolulu", "Cairo", "Sydney", "Bangkok", "Rio de Janeiro", "Berlin", "Tokyo", "Seoul"];

let audioCtx = null;
function playSound(type) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);

        if (type === 'click') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(140, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.06);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.06);
            osc.start(); osc.stop(audioCtx.currentTime + 0.06);
        } else if (type === 'success') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); 
            osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.08); 
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.start(); osc.stop(audioCtx.currentTime + 0.3);
        }
    } catch(e) {}
}

window.selectCity = function(cityName) {
    try { playSound('click'); } catch(e) {}
    document.getElementById("cityInput").value = cityName;
    searchMusic(`${BASE_WEATHER_URL}q=${cityName}&appid=${WEATHER_API_KEY}&units=metric`);
};

function generateRandomString(length) {
    let text = ''; const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    const base64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let result = ""; const bytes = new Uint8Array(digest);
    for (let i = 0; i < bytes.length; i += 3) {
        const b1 = bytes[i], b2 = i + 1 < bytes.length ? bytes[i + 1] : 0, b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
        const group = (b1 << 16) | (b2 << 8) | b3;
        result += base64chars[(group >> 18) & 63] + base64chars[(group >> 12) & 63];
        result += i + 1 < bytes.length ? base64chars[(group >> 6) & 63] : "";
        result += i + 2 < bytes.length ? base64chars[group & 63] : "";
    }
    return result;
}

async function searchMusic(weatherUrl) {
    const resultDiv = document.getElementById("result");
    const loaderContainer = document.getElementById("loaderContainer");
    const loadingText = document.getElementById("loadingText");
    const guidance = document.getElementById("initialGuidance");
    const token = localStorage.getItem("spotify_access_token");

    if (!token) {
        alert("Spotifyのアカウント同期が完了していないか、セッションが切れています。トップのボタンからログインし直してください。");
        return;
    }

    if(guidance) guidance.style.display = "none";
    resultDiv.innerHTML = "";
    loaderContainer.style.display = "block";

    try {
        const wRes = await fetch(weatherUrl);
        const wData = await wRes.json();
        if (wData.cod !== 200) throw new Error("天気データの取得に失敗しました。都市名を確認してください。");

        const weather = wData.weather[0].main;
        const temp = Math.round(wData.main.temp);
        const cityName = wData.name;

        if (weather === "Clear") {
            document.body.style.background = "linear-gradient(135deg, #2b1d0a 0%, #120b02 40%, #050506 100%)";
        } else if (weather === "Rain" || weather === "Drizzle" || weather === "Thunderstorm") {
            document.body.style.background = "linear-gradient(135deg, #051425 0%, #020914 50%, #030406 100%)";
        } else if (weather === "Clouds") {
            document.body.style.background = "linear-gradient(135deg, #171a22 0%, #0c0e12 50%, #040506 100%)";
        } else {
            document.body.style.background = "linear-gradient(135deg, #190e2b 0%, #0a0514 50%, #030206 100%)";
        }
        document.body.style.backgroundSize = "400% 400%";

        const hour = new Date().getHours();
        let timeTag = "night";
        let emotionLabel = "憂鬱・哀愁（Melancholic）";
        
        if (hour >= 5 && hour < 11) { 
            timeTag = "morning"; emotionLabel = "覚醒・幸福感（Euphoric）"; 
        } else if (hour >= 11 && hour < 16) { 
            timeTag = "afternoon"; emotionLabel = "輝き・高揚（Upbeat）"; 
        } else if (hour >= 16 && hour < 19) { 
            timeTag = "sunset"; emotionLabel = "安らぎ・静寂（Cozy Chill）"; 
        }

        loadingText.innerHTML = `
            <span style="font-size:0.8rem; letter-spacing:2px; color:var(--spotify-green); font-weight:700;">CONNECTING STATION: ${cityName.toUpperCase()}</span><br>
            <span style="font-size:1.4rem; font-weight:800; font-family:'Space Grotesk'">${weather} / ${temp}°C</span><br>
            <span style="font-size:0.8rem; color:rgba(255,255,255,0.4); font-weight:500;">感情パラメーター解析: ${emotionLabel}</span>
        `;

        let weatherTag = "chill";
        if (weather === "Clear") weatherTag = temp >= 25 ? "summer" : "cheerful";
        else if (weather === "Rain") weatherTag = "rainy jazz";
        else if (weather === "Clouds") weatherTag = "lofi ambient";

        let q = `${weatherTag} ${timeTag}`;
        
        const sRes = await fetch(`${BASE_API_URL}/search?q=${encodeURIComponent(q)}&type=track&limit=6`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!sRes.ok) throw new Error("Spotifyとの通信に失敗しました。最下部のボタンでリセットして再ログインしてください。");

        const sData = await sRes.json();
        if (!sData || !sData.tracks || !sData.tracks.items) throw new Error("有効な曲データを受信できませんでした。");

        if (sData.tracks.items.length === 0) {
            resultDiv.innerHTML = `<p style="color:rgba(255,255,255,0.5); text-align:center;">該当する楽曲が見つかりませんでした。</p>`;
            loaderContainer.style.display = "none";
            return;
        }

        try { playSound('success'); } catch(e) {}
        loaderContainer.style.display = "none";
        
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:15px;">
                <span class="section-title" style="margin:0;">RECOMMENDED TRACKS</span>
                <span style="font-size:0.75rem; font-weight:700; color:var(--spotify-green); background:rgba(29,185,84,0.1); padding:4px 8px; border-radius:6px; font-family:'Space Grotesk'">${cityName} SYNCHRONIZED</span>
            </div>
            <div class="results-grid">`;
        
        const trackUris = [];
        sData.tracks.items.forEach(track => {
            const imgUrl = (track.album && track.album.images && track.album.images[0]) ? track.album.images[0].url : "https://via.placeholder.com/60/141923/fff?text=MUSIC";
            trackUris.push(track.uri);
            html += `
                <div class="track-card">
                    <img src="${imgUrl}" class="track-img">
                    <div class="track-info">
                        <div class="track-title">${track.name}</div>
                        <div class="track-artist">${track.artists[0].name}</div>
                        <a href="${track.external_urls.spotify}" target="_blank" class="track-link">PREVIEW ON SPOTIFY ↗</a>
                    </div>
                </div>`;
        });
        html += `</div>`;

        html += `<button class="btn btn-spotify" style="margin-top:30px; font-size:1rem; padding:18px;" id="savePlaylistBtn">💾 空間オーディオスロットへ保存</button>`;
        resultDiv.innerHTML = html;

        document.getElementById("savePlaylistBtn").addEventListener("click", function() {
            savePlaylist(this, `${cityName} ${weather} Pulse`, trackUris);
        });

    } catch (e) { 
        loaderContainer.style.display = "none";
        alert(e.message); 
    }
}

// --- EVENTS ---
document.getElementById("loginBtn").addEventListener("click", async () => {
    try { playSound('click'); } catch(e) {}
    const verifier = generateRandomString(128);
    localStorage.setItem("spotify_verifier", verifier);
    const challenge = await generateCodeChallenge(verifier);
    
    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: 'playlist-modify-public playlist-modify-private',
        code_challenge_method: 'S256',
        code_challenge: challenge
    });
    window.location.href = BASE_AUTH_URL + params.toString();
});

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
    });
}

const savedToken = localStorage.getItem("spotify_access_token");
if (savedToken) {
    document.getElementById("loginBtn").style.display = "none";
    document.getElementById("weatherAppSection").style.display = "block";
    document.getElementById("actionSection").style.display = "block";
    
    fetch(`${BASE_API_URL}/me`, { headers: { 'Authorization': 'Bearer ' + savedToken } })
        .then(r => r.json()).then(data => {
            if(data && data.display_name) {
                const profile = document.getElementById("userProfile");
                profile.innerText = `TRAVELER: ${data.display_name.toUpperCase()}`;
            }
        }).catch(err => {
            console.log("ユーザー情報の取得に失敗しました。");
        });
}

document.getElementById("gpsBtn").addEventListener("click", () => {
    try { playSound('click'); } catch(e) {}
    const loaderContainer = document.getElementById("loaderContainer");
    const loadingText = document.getElementById("loadingText");
    if(document.getElementById("initialGuidance")) document.getElementById("initialGuidance").style.display = "none";
    document.getElementById("result").innerHTML = "";
    
    loadingText.innerHTML = `<span style="font-size:0.8rem; letter-spacing:2px; color:var(--trip-purple); font-weight:700;">ORBITAL SATELLITE SCANNING</span><br><span style="font-size:1.1rem; font-weight:700;">GPS位置情報から気象レーダーを追跡中...</span>`;
    loaderContainer.style.display = "block";

    navigator.geolocation.getCurrentPosition(p => {
        searchMusic(`${BASE_WEATHER_URL}lat=${p.coords.latitude}&lon=${p.coords.longitude}&appid=${WEATHER_API_KEY}&units=metric`);
    }, (error) => {
        loaderContainer.style.display = "none";
        alert("衛星シグナル受信失敗。GPS許可を確認してください。");
    });
});

document.getElementById("getWeatherBtn").addEventListener("click", () => {
    try { playSound('click'); } catch(e) {}
    const city = document.getElementById("cityInput").value || "Kyoto";
    searchMusic(`${BASE_WEATHER_URL}q=${city}&appid=${WEATHER_API_KEY}&units=metric`);
});

document.getElementById("tripBtn").addEventListener("click", () => {
    try { playSound('click'); } catch(e) {}
    const city = WORLD_CITIES[Math.floor(Math.random() * WORLD_CITIES.length)];
    document.getElementById("cityInput").value = city;
    searchMusic(`${BASE_WEATHER_URL}q=${city}&appid=${WEATHER_API_KEY}&units=metric`);
});

// 🌟【403エラー完全対応】最も安全な個人エンドポイント（/me/playlists）へ修正
window.savePlaylist = async function(btn, name, uris) {
    try { playSound('click'); } catch(e) {}
    const token = localStorage.getItem("spotify_access_token");
    const originalText = btn.innerText;
    btn.innerText = "⏳ プレイリスト作成中...";
    
    try {
        // 🌟 /users/{id}/playlists ではなく、認証された本人に直接作成する /me/playlists に変更
        const r1 = await fetch(`${BASE_API_URL}/me/playlists`, {
            method: 'POST', 
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, public: false, description: "Synced by Weather Resonance App" })
        });
        
        if (!r1.ok) {
            const errData = await r1.json();
            throw new Error(`Spotify側が拒絶しました: ${errData.error.message}`);
        }
        const d1 = await r1.json();
        const playlistId = d1.id;

        // 2. 生成されたプレイリストに曲を追加
        const r2 = await fetch(`${BASE_API_URL}/playlists/${playlistId}/tracks`, {
            method: 'POST', 
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ uris: uris })
        });
        
        if (!r2.ok) throw new Error("プレイリストへの曲の追加に失敗しました。");

        const spotifyUrl = d1.external_urls.spotify;
        try { playSound('success'); } catch(e) {}
        btn.outerHTML = `<a href="${spotifyUrl}" target="_blank" class="btn btn-spotify" style="text-decoration:none; display:flex; justify-content:center; background:#1ed760; color:#000; box-shadow: 0 0 30px rgba(29, 185, 84, 0.6); font-size:1rem; padding:18px;">✨ ARCHIVE COMPLETE / SPOTIFYで開く</a>`;
        window.open(spotifyUrl, '_blank');
        
    } catch (e) { 
        alert("保存失敗: " + e.message); 
        btn.innerText = originalText;
    }
};

document.getElementById("clearBtn").addEventListener("click", () => { localStorage.clear(); location.reload(); });
