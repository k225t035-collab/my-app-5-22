// ====== あなたの設定項目 ======
const WEATHER_API_KEY = "6569f9193b1871a2521eeb1bb5ffc92a";
const SPOTIFY_CLIENT_ID = "e7abf7e217d7455b94b584b7ffbb58e8";
const REDIRECT_URI = "https://k225t035-collab.github.io/my-app-5-22/";
// =============================

// ※ const CITY = "Kyoto"; は削除しました！

const s_part1 = "accounts";
const s_part2 = "spotify";
const s_part3 = "com";
const s_part4 = "api";

const BASE_AUTH_URL = `https://${s_part1}.${s_part2}.${s_part3}/authorize?`;
const BASE_TOKEN_URL = `https://${s_part1}.${s_part2}.${s_part3}/api/token`;
const BASE_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather?";

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
        scope: 'playlist-modify-public',
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

// 3. Weather & Music
document.getElementById("getWeatherBtn").addEventListener("click", async () => {
    const accessToken = localStorage.getItem("spotify_access_token");
    if (!accessToken) return alert("Spotifyと連携してください");

    // 🌟 今回追加：入力欄から都市名を取得（空欄ならKyotoにする）
    const inputCity = document.getElementById("cityInput").value.trim() || "Kyoto";
    const safeApiKey = encodeURIComponent(WEATHER_API_KEY.trim());
    
    // 入力された都市名を使ってURLを作成
    const weatherUrl = BASE_WEATHER_URL + `q=${encodeURIComponent(inputCity)}&appid=${safeApiKey}&units=metric`;

    try {
        // --- 天気APIの通信 ---
        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();

        // 存在しない都市名が入力された場合のエラーハンドリング
        if (weatherData.cod === "404") {
            throw new Error(`「${inputCity}」という都市は見つかりませんでした。英語のスペルを確認してみてください。`);
        } else if (weatherData.cod && weatherData.cod !== 200) {
            throw new Error(`【天気APIエラー】${weatherData.message}`);
        }

        const weather = weatherData.weather[0].main; 
        const temp = Math.round(weatherData.main.temp);
        const actualCityName = weatherData.name; // APIから返ってきた正式な都市名

        // --- 天気に合わせた「検索キーワード」の決定 ---
        let searchQuery = "feel good pop"; 
        
        if (weather === "Clear") {
            searchQuery = "summer drive vibe"; 
        } else if (weather === "Rain") {
            searchQuery = "rainy day jazz cafe"; 
        } else if (weather === "Clouds") {
            searchQuery = "lofi ambient chill"; 
        } else if (weather === "Snow") {
            searchQuery = "winter acoustic cozy"; 
        }

        const spotifySearchUrl = `https://${s_part4}.${s_part2}.${s_part3}/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=5`;
        
        const spotifyResponse = await fetch(spotifySearchUrl, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        const spotifyData = await spotifyResponse.json();

        if (spotifyData.error) {
            throw new Error(`【Spotifyエラー】${spotifyData.error.message}`);
        }

        let htmlContent = `
            <h3 style="margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px;">
                ☁️ ${actualCityName}の天気: ${weather} (${temp}℃)
            </h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
        `;

        if (spotifyData.tracks && spotifyData.tracks.items && spotifyData.tracks.items.length > 0) {
            spotifyData.tracks.items.forEach(track => {
                const albumImg = track.album.images[0] ? track.album.images[0].url : "";
                const spotifyLink = track.external_urls.spotify;
                
                htmlContent += `
                    <li style="display: flex; align-items: center; background: rgba(0,0,0,0.3); margin-bottom: 15px; padding: 10px; border-radius: 12px; transition: transform 0.2s;">
                        <img src="${albumImg}" alt="Album Art" style="width: 55px; height: 55px; border-radius: 8px; margin-right: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                        <div style="flex-grow: 1; text-align: left;">
                            <strong style="font-size: 1.05rem; display: block; margin-bottom: 3px;">${track.name}</strong>
                            <span style="font-size: 0.85rem; color: #b3b3b3;">${track.artists[0].name}</span>
                        </div>
                        <a href="${spotifyLink}" target="_blank" style="background-color: #1DB954; color: white; text-decoration: none; padding: 8px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; margin-left: 10px; box-shadow: 0 2px 8px rgba(29, 185, 84, 0.4);">
                            聴く
                        </a>
                    </li>
                `;
            });
        } else {
            htmlContent += "<li>曲が見つかりませんでした。</li>";
        }
        htmlContent += "</ul>";

        document.getElementById("result").innerHTML = htmlContent;

    } catch (error) {
        console.error("詳細:", error);
        document.getElementById("result").innerHTML = `<p style="color: #ff6b6b;"><strong>エラーが発生しました：</strong><br>${error.message}</p>`;
    }
});
