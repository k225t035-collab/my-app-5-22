// ====== あなたの設定項目 ======
const WEATHER_API_KEY = "6569f9193b1871a2521eeb1bb5ffc92a";
const SPOTIFY_CLIENT_ID = "e7abf7e217d7455b94b584b7ffbb58e8";
const REDIRECT_URI = "";
// =============================
const CITY = "Kyoto";

const s_part1 = "accounts";
const s_part2 = "spotify";
const s_part3 = "com";
const s_part4 = "api";

const BASE_AUTH_URL = `https://${s_part1}.${s_part2}.${s_part3}/authorize?`;
const BASE_TOKEN_URL = `https://${s_part1}.${s_part2}.${s_part3}/api/token`;
const BASE_RECOMMEND_URL = `https://${s_part4}.${s_part2}.${s_part3}/v1/recommendations?`;
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

    const safeApiKey = encodeURIComponent(WEATHER_API_KEY.trim());
    const weatherUrl = BASE_WEATHER_URL + `q=${CITY}&appid=${safeApiKey}&units=metric`;

    try {
        // --- 天気APIの通信 ---
        const weatherResponse = await fetch(weatherUrl);
        const weatherText = await weatherResponse.text();
        
        let weatherData;
        try {
            weatherData = JSON.parse(weatherText);
        } catch (e) {
            throw new Error(`【天気データの解析エラー】サーバーからの返答: ${weatherText}`);
        }

        if (weatherData.cod && weatherData.cod !== 200) {
            throw new Error(`【天気APIエラー】コード: ${weatherData.cod}, メッセージ: ${weatherData.message}`);
        }

        const weather = weatherData.weather[0].main; 
        const temp = weatherData.main.temp;

        // --- Spotifyおすすめ曲の通信 ---
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
        
        const spotifyResponse = await fetch(spotifyUrl, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        const spotifyText = await spotifyResponse.text();

        let spotifyData;
        try {
            spotifyData = JSON.parse(spotifyText);
        } catch (e) {
            throw new Error(`【Spotifyデータの解析エラー】サーバーからの返答: ${spotifyText}`);
        }

        if (spotifyData.error) {
            if (spotifyData.error.status === 401) {
                localStorage.removeItem("spotify_access_token");
                throw new Error("【Spotifyエラー】認証期限が切れました。ページを更新してもう一度「1」から連携してください。");
            }
            throw new Error(`【Spotifyエラー】${spotifyData.error.message}`);
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
        document.getElementById("result").innerHTML = `<p style="color: #ff6b6b;"><strong>エラーが発生しました：</strong><br>${error.message}</p>`;
    }
});
