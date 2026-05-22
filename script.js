// ====== あなたの設定項目 ======
const WEATHER_API_KEY = "6569f9193b1871a2521eeb1bb5ffc92a";
const SPOTIFY_CLIENT_ID = "e7abf7e217d7455b94b584b7ffbb58e8";
const REDIRECT_URI = "https://k225t035-collab.github.io/my-app-5-22/";
// =============================

const s_part1 = "accounts";
const s_part2 = "spotify";
const s_part3 = "com";
const s_part4 = "api";

const BASE_AUTH_URL = `https://${s_part1}.${s_part2}.${s_part3}/authorize?`;
const BASE_TOKEN_URL = `https://${s_part1}.${s_part2}.${s_part3}/api/token`;
const BASE_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather?";
const BASE_API_URL = `https://${s_part4}.${s_part2}.${s_part3}/v1`;

// グローバル変数（アプリ全体で共有するデータ）
let currentAudio = null;       // 現在再生中の試聴音源
let currentPlayBtn = null;     // 現在再生中のボタン
let currentTrackUris = [];     // 検索された5曲のURI（プレイリスト保存用）
let currentPlaylistName = "";  // 作成するプレイリスト名

function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
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

// 1. Spotify Login
document.getElementById("loginBtn").addEventListener("click", async () => {
    const verifier = generateRandomString(128);
    localStorage.setItem("spotify_verifier", verifier);
    const challenge = await generateCodeChallenge(verifier);

    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID.trim(),
        response_type: 'code',
        redirect_uri: REDIRECT_URI.trim(),
        scope: 'playlist-modify-public', // プレイリスト作成権限
        code_challenge_method: 'S256',
        code_challenge: challenge
    });
    window.location.href = BASE_AUTH_URL + params.toString(); 
});

// 2. Token Exchange
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

if (code) {
    document.getElementById("loginBtn").innerText = "⏳ 連携処理中...";
    document.getElementById("loginBtn").disabled = true;
    const verifier = localStorage.getItem("spotify_verifier");

    const body = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID.trim(),
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI.trim(),
        code_verifier: verifier
    });

    fetch(BASE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
    })
    .then(response => response.json())
    .then(data => {
        if (data.access_token) {
            localStorage.setItem("spotify_access_token", data.access_token);
            window.history.replaceState({}, document.title, window.location.pathname);
            document.getElementById("loginBtn").innerText = "🔒 Spotify連携済み";
            document.getElementById("getWeatherBtn").disabled = false;
            document.getElementById("result").innerHTML = "<p>連携が成功しました！「2」のボタンを押してください。</p>";
        } else {
            document.getElementById("result").innerHTML = `<p style="color:#ff6b6b;">【Spotify認証エラー】${JSON.stringify(data)}</p>`;
        }
    })
    .catch(error => {
        document.getElementById("result").innerHTML = `<p style="color:#ff6b6b;">【Spotify通信エラー】${error.message}</p>`;
    });
} else if (localStorage.getItem("spotify_access_token")) {
    document.getElementById("loginBtn").innerText = "🔒 Spotify連携済み";
    document.getElementById("loginBtn").disabled = true;
    document.getElementById("getWeatherBtn").disabled = false;
}

// 核心：天気と音楽を取得して表示する共通処理
async function fetchWeatherAndMusic(weatherUrl) {
    const accessToken = localStorage.getItem("spotify_access_token");
    if (!accessToken) return alert("Spotifyと連携してください");

    // 新しい検索をするときは、再生中の音を止める
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }

    try {
        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();

        if (weatherData.cod === "404") {
            throw new Error(`都市が見つかりませんでした。スペルを確認してください。`);
        } else if (weatherData.cod && weatherData.cod !== 200) {
            throw new Error(`【天気APIエラー】${weatherData.message}`);
        }

        const weather = weatherData.weather[0].main; 
        const temp = Math.round(weatherData.main.temp);
        const actualCityName = weatherData.name;

        // プレイリスト名を自動生成して記憶
        currentPlaylistName = `Weather Beats: ${actualCityName} (${weather})`;

        let searchQuery = "feel good pop"; 
        if (weather === "Clear") searchQuery = "summer drive vibe"; 
        else if (weather === "Rain") searchQuery = "rainy day jazz cafe"; 
        else if (weather === "Clouds") searchQuery = "lofi ambient chill"; 
        else if (weather === "Snow") searchQuery = "winter acoustic cozy"; 

        const spotifySearchUrl = `${BASE_API_URL}/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=5`;
        const spotifyResponse = await fetch(spotifySearchUrl, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        const spotifyData = await spotifyResponse.json();

        if (spotifyData.error) {
            if (spotifyData.error.status === 401 || spotifyData.error.message.includes("expired")) {
                localStorage.removeItem("spotify_access_token");
                throw new Error("Spotifyの連携期限（1時間）が切れました。<br>🔄 ページを再読み込みして連携し直してください。");
            }
            throw new Error(`【Spotifyエラー】${spotifyData.error.message}`);
        }

        let htmlContent = `
            <h3 style="margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px;">
                ☁️ ${actualCityName}: ${weather} (${temp}℃)
            </h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
        `;

        currentTrackUris = []; // リストを初期化

        if (spotifyData.tracks && spotifyData.tracks.items && spotifyData.tracks.items.length > 0) {
            spotifyData.tracks.items.forEach((track, index) => {
                const albumImg = track.album.images[0] ? track.album.images[0].url : "";
                const spotifyLink = track.external_urls.spotify;
                const previewUrl = track.preview_url; // 30秒試聴URL

                // プレイリスト保存用に曲のURIを溜める
                currentTrackUris.push(track.uri);
                
                // 試聴ボタンのHTML（URLが無い曲は「試聴不可」にする）
                const previewButtonHtml = previewUrl 
                    ? `<button class="preview-btn" onclick="togglePreview('${previewUrl}', this)">▶ 試聴</button>`
                    : `<button class="preview-btn" disabled style="opacity:0.3;">選択不可</button>`;

                htmlContent += `
                    <li style="display: flex; align-items: center; background: rgba(0,0,0,0.3); margin-bottom: 15px; padding: 10px; border-radius: 12px;">
                        <img src="${albumImg}" alt="Album Art" style="width: 55px; height: 55px; border-radius: 8px; margin-right: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                        <div style="flex-grow: 1; text-align: left; overflow: hidden;">
                            <strong style="font-size: 1rem; display: block; margin-bottom: 3px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${track.name}</strong>
                            <span style="font-size: 0.8rem; color: #b3b3b3; display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${track.artists[0].name}</span>
                        </div>
                        <div style="display: flex; align-items: center; flex-shrink: 0;">
                            ${previewButtonHtml}
                            <a href="${spotifyLink}" target="_blank" style="background-color: #1DB954; color: white; text-decoration: none; padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: bold;">
                                本編
                            </a>
                        </div>
                    </li>
                `;
            });

            // 💾 プレイリスト保存ボタンを末尾に追加
            htmlContent += `
                </ul>
                <button id="playlistBtn" class="btn" onclick="saveToSpotifyPlaylist(this)">💾 この5曲をSpotifyに保存</button>
            `;
        } else {
            htmlContent += "<li>曲が見つかりませんでした。</li></ul>";
        }

        document.getElementById("result").innerHTML = htmlContent;

    } catch (error) {
        document.getElementById("result").innerHTML = `<p style="color: #ff6b6b;"><strong>エラーが発生しました：</strong><br>${error.message}</p>`;
    }
}

// ボタン入力での検索
document.getElementById("getWeatherBtn").addEventListener("click", () => {
    const inputCity = document.getElementById("cityInput").value.trim() || "Kyoto";
    const safeApiKey = encodeURIComponent(WEATHER_API_KEY.trim());
    const weatherUrl = BASE_WEATHER_URL + `q=${encodeURIComponent(inputCity)}&appid=${safeApiKey}&units=metric`;
    fetchWeatherAndMusic(weatherUrl);
});

// 📍 GPS連動機能
document.getElementById("gpsBtn").addEventListener("click", () => {
    if (!navigator.geolocation) return alert("お使いのブラウザはGPSに対応していません");
    
    document.getElementById("result").innerHTML = "<p style='text-align:center;'>📍 現在地を特定中...</p>";
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const safeApiKey = encodeURIComponent(WEATHER_API_KEY.trim());
            const weatherUrl = BASE_WEATHER_URL + `lat=${lat}&lon=${lon}&appid=${safeApiKey}&units=metric`;
            fetchWeatherAndMusic(weatherUrl);
        },
        (error) => {
            document.getElementById("result").innerHTML = `<p style="color: #ff6b6b;">GPS取得失敗: ${error.message}<br>ブラウザの位置情報許可を確認してください。</p>`;
        }
    );
});

// 🎧 30秒プレビュー再生のコントロール
window.togglePreview = function(url, btn) {
    if (currentAudio && currentAudio.src === url) {
        // 同じ曲がタップされたら止める
        currentAudio.pause();
        currentAudio = null;
        btn.innerText = "▶ 試聴";
        btn.classList.remove("playing");
    } else {
        // 別の曲が再生中なら、まずそれを止める
        if (currentAudio) {
            currentAudio.pause();
            if (currentPlayBtn) {
                currentPlayBtn.innerText = "▶ 試聴";
                currentPlayBtn.classList.remove("playing");
            }
        }
        // 新しい曲を再生
        currentAudio = new Audio(url);
        currentAudio.play();
        currentPlayBtn = btn;
        btn.innerText = "⏸ 停止";
        btn.classList.add("playing");

        // 曲が終わりまで再生されたらボタンを元に戻す
        currentAudio.onended = () => {
            btn.innerText = "▶ 試聴";
            btn.classList.remove("playing");
            currentAudio = null;
        };
    }
};

// 💾 Spotifyプレイリスト作成・保存機能
window.saveToSpotifyPlaylist = async function(btn) {
    const accessToken = localStorage.getItem("spotify_access_token");
    if (currentTrackUris.length === 0) return;

    btn.innerText = "⏳ プレイリスト作成中...";
    btn.disabled = true;

    try {
        // 1. ログイン中の自分のユーザーIDを取得
        const meResponse = await fetch(`${BASE_API_URL}/me`, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        const meData = await meResponse.json();
        const userId = meData.id;

        // 2. 空のプレイリストを新規作成
        const createPlaylistResponse = await fetch(`${BASE_API_URL}/users/${userId}/playlists`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: currentPlaylistName,
                public: true,
                description: "Weather Beats アプリから自動生成されたプレイリスト"
            })
        });
        const playlistData = await createPlaylistResponse.json();
        const playlistId = playlistData.id;

        // 3. 作成したプレイリストに5曲を追加
        await fetch(`${BASE_API_URL}/playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uris: currentTrackUris })
        });

        btn.innerText = "✨ Spotifyに保存完了！";
        btn.style.background = "#1DB954";
        alert(`Spotifyに新しいプレイリスト「${currentPlaylistName}」を作成し、5曲を保存しました！`);

    } catch (error) {
        console.error(error);
        btn.innerText = "❌ 保存失敗";
        btn.disabled = false;
        alert("プレイリストの作成に失敗しました: " + error.message);
    }
};
