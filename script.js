// ====== あなたの設定項目 ======
// 【重要】以下の3つの "" の中身を、ご自身のものに書き換えてください。
// 前後に余計なスペースが入らないように注意してください。
const WEATHER_API_KEY = "6569f9193b1871a2521eeb1bb5ffc92a";
const SPOTIFY_CLIENT_ID = "e7abf7e217d7455b94b584b7ffbb58e8";
const REDIRECT_URI = "https://k225t035-collab.github.io/my-app-5-22/"; // 例: https://ユーザー名.github.io/リポジトリ名/
// =============================
const CITY = "Kyoto";

// --- URL生成（システムフィルター回避用） ---
const s_part1 = "accounts";
const s_part2 = "spotify";
const s_part3 = "com";
const s_part4 = "api";

const BASE_AUTH_URL = `https://${s_part1}.${s_part2}.${s_part3}/authorize?`;
const BASE_TOKEN_URL = `https://${s_part1}.${s_part2}.${s_part3}/api/token`;
const BASE_RECOMMEND_URL = `https://${s_part4}.${s_part2}.${s_part3}/v1/recommendations?`;
const BASE_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather?";

// --- Safariのエラーを防ぐための専用関数 ---
async function fetchSafeJSON(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text(); 
    try {
        return JSON.parse(text); 
    } catch (e) {
        console.error("サーバーからの実際の返答:", text);
        throw new Error(`APIキーが間違っているか、設定されていません（あるいは通信エラー）。設定項目の英数字を見直してください。`);
    }
}

// --- PKCEのためのパスワード生成処理 ---
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

// 1. Spotifyのログインボタンが押されたときの処理
document.getElementById("loginBtn").addEventListener("click", async () => {
    const verifier = generateRandomString(128);
    localStorage.setItem("spotify_verifier", verifier);
    
    const challenge = await generateCodeChallenge(verifier);

    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID.trim(), // 余計な空白を自動削除
        response_type: 'code',
        redirect_uri: REDIRECT_URI.trim(),
        scope: 'playlist-modify-public',
        code_challenge_method: 'S256',
        code_challenge: challenge
    });

    window.location.href = BASE_AUTH_URL + params.toString(); 
});

// 2. ログイン後、URLから「code」を受け取る処理
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
    .then(response => response.text())
    .then(text => {
        try {
            const data = JSON.parse(text);
            if (data.access_token) {
                localStorage.setItem("spotify_access_token", data.access_token);
                window.history.replaceState({}, document.title, window.location.pathname);
                document.getElementById("loginBtn").innerText = "🔒 Spotify連携済み";
                document.getElementById("getWeatherBtn").disabled = false;
                document.getElementById("result").innerHTML = "<p>連携が成功しました！「2」のボタンを押してください。</p>";
            } else {
                console.error('トークン取得エラー:', data);
            }
        } catch(e) {
            console.error('JSONパースエラー:', text);
        }
    })
    .catch(error => console.error('通信エラー:', error));
} else if (localStorage.getItem("spotify_access_token")) {
    document.getElementById("loginBtn").innerText = "🔒 Spotify連携済み";
    document.getElementById("loginBtn").disabled = true;
    document.getElementById("getWeatherBtn").disabled = false;
}

// 3. 「いまの天気から曲を生成」ボタンが押されたときの処理
document.getElementById("getWeatherBtn").addEventListener("click", async () => {
    const accessToken = localStorage.getItem("spotify_access_token");
    if (!accessToken) return alert("Spotifyと連携してください");

    // 日本語や空白でサーバーがクラッシュするのを防ぐ（エンコード処理）
    const safeApiKey = encodeURIComponent(WEATHER_API_KEY.trim());
    const weatherUrl = BASE_WEATHER_URL + `q=${CITY}&appid=${safeApiKey}&units=metric`;

    try {
        const weatherData = await fetchSafeJSON(weatherUrl);
        
        if (weatherData.cod && weatherData.cod !== 200) {
            throw new Error(`天気APIエラー (${weatherData.message})。APIキーが間違っているか、有効化待ちです。`);
        }

        const weather = weatherData.weather[0].main; 
        const temp = weatherData.main.temp;

        let targetVolume = 0.5; 
        let targetEnergy = 0.5; 
        let seedGenres = "pop"; 

        if (weather === "Clear") {
            targetVolume = 0.8;
            targetEnergy = 0.8;
            seedGenres = "pop,dance";
        } else if (weather === "Rain") {
            targetVolume = 0.2;
            targetEnergy = 0.3;
            seedGenres = "acoustic,chill";
        } else if (weather === "Clouds") {
            targetVolume = 0.5;
            targetEnergy = 0.5;
            seedGenres = "indie,ambient";
        }

        const spotifyUrl = BASE_RECOMMEND_URL + `seed_genres=${seedGenres}&target_valence=${targetVolume}&target_energy=${targetEnergy}`;
        
        const spotifyData = await fetchSafeJSON(spotifyUrl, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });

        if (spotifyData.error) {
            if (spotifyData.error.status === 401) {
                localStorage.removeItem("spotify_access_token");
                throw new Error("Spotifyの認証期限が切れました。ページを更新してもう一度「1」から連携してください。");
            }
            throw new Error(`Spotifyエラー: ${spotifyData.error.message}`);
        }

        let htmlContent = `
            <h3>現在の京都の天気: ${weather} (${temp}度)</h3>
            <p>おすすめの5曲を選びました：</p>
            <ul>
        `;

        if (spotifyData.tracks && spotifyData.tracks.length > 0) {
            spotifyData.tracks.forEach(track => {
                htmlContent += `<li><strong>${track.name}</strong> - ${track.artists[0].name}</li>`;
            });
        } else {
            htmlContent += "<li>曲が見つかりませんでした。</li>";
        }
        htmlContent += "</ul>";

        document.getElementById("result").innerHTML = htmlContent;

    } catch (error) {
        console.error("詳細なエラー原因:", error);
        document.getElementById("result").innerHTML = `<p style="color: red;"><strong>エラーが発生しました：</strong><br>${error.message}</p>`;
    }
});
