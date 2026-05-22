// ====== あなたの設定項目 ======
const WEATHER_API_KEY = "あなたのOpenWeatherMapのAPIキー";
const SPOTIFY_CLIENT_ID = "あなたのSpotifyのClient ID";
const REDIRECT_URI = "あなたのGitHub PagesのURL"; // 例: https://ユーザー名.github.io/リポジトリ名/
// =============================
const CITY = "Kyoto";

// --- 【重要】PKCE（セキュリティ強化版）のためのパスワード生成処理 ---
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
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// 1. Spotifyのログインボタンが押されたときの処理
document.getElementById("loginBtn").addEventListener("click", async () => {
    const verifier = generateRandomString(128);
    localStorage.setItem("spotify_verifier", verifier); // ブラウザに一時保存
    
    const challenge = await generateCodeChallenge(verifier);

    // 新しいルールの通り、response_typeを 'code' に変更しています
    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: 'playlist-modify-public',
        code_challenge_method: 'S256',
        code_challenge: challenge
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`; 
});

// 2. ログイン後、URLから「code」を受け取って正式な「鍵」に交換する処理
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

if (code) {
    document.getElementById("loginBtn").innerText = "⏳ 連携処理中...";
    document.getElementById("loginBtn").disabled = true;

    const verifier = localStorage.getItem("spotify_verifier");

    const body = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier
    });

    // 取得したcodeを正式なアクセストークン（鍵）と交換します
    fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
    })
    .then(response => response.json())
    .then(data => {
        if (data.access_token) {
            localStorage.setItem("spotify_access_token", data.access_token);
            window.history.replaceState({}, document.title, window.location.pathname); // URLを綺麗にする
            
            document.getElementById("loginBtn").innerText = "🔒 Spotify連携済み";
            document.getElementById("getWeatherBtn").disabled = false;
            document.getElementById("result").innerHTML = "<p>連携が成功しました！「2」のボタンを押してください。</p>";
        }
    })
    .catch(error => console.error('Token Error:', error));
} else if (localStorage.getItem("spotify_access_token")) {
    // すでにログイン済みの場合
    document.getElementById("loginBtn").innerText = "🔒 Spotify連携済み";
    document.getElementById("loginBtn").disabled = true;
    document.getElementById("getWeatherBtn").disabled = false;
}

// 3. 「いまの天気から曲を生成」ボタンが押されたときの処理
document.getElementById("getWeatherBtn").addEventListener("click", async () => {
    const accessToken = localStorage.getItem("spotify_access_token");
    if (!accessToken) return alert("Spotifyと連携してください");

    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${WEATHER_API_KEY}&units=metric`;

    try {
        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();
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

        const spotifyUrl = `https://api.spotify.com/v1/recommendations?seed_genres=${seedGenres}&target_valence=${targetVolume}&target_energy=${targetEnergy}`;
        
        const spotifyResponse = await fetch(spotifyUrl, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        const spotifyData = await spotifyResponse.json();

        let htmlContent = `
            <h3>現在の京都の天気: ${weather} (${temp}度)</h3>
            <p>おすすめの5曲を選びました：</p>
            <ul>
        `;

        spotifyData.tracks.forEach(track => {
            htmlContent += `<li><strong>${track.name}</strong> - ${track.artists[0].name}</li>`;
        });
        htmlContent += "</ul>";

        document.getElementById("result").innerHTML = htmlContent;

    } catch (error) {
        console.error("エラーが発生しました", error);
        document.getElementById("result").innerHTML = "<p>データの取得に失敗しました。設定を見直してください。</p>";
    }
});
