// ====== あなたの設定項目 ======
const WEATHER_API_KEY = "6569f9193b1871a2521eeb1bb5ffc92a";
const SPOTIFY_CLIENT_ID = "e7abf7e217d7455b94b584b7ffbb58e8";
const REDIRECT_URI = "https://k225t035-collab.github.io/my-app-5-22/"; // 例: https://ユーザー名.github.io/リポジトリ名/
// =============================

const CITY = "Kyoto"; 

// 1. URLからSpotifyのアクセストークン（一時的な鍵）を抜き出す処理
function getAccessToken() {
    const hash = window.location.hash;
    if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        return params.get("access_token");
    }
    return null;
}

const token = getAccessToken();

// トークンが取れた（ログイン完了した）場合の画面切り替え
if (token) {
    document.getElementById("loginBtn").innerText = "🔒 Spotify連携済み";
    document.getElementById("loginBtn").disabled = true;
    document.getElementById("getWeatherBtn").disabled = false;
    document.getElementById("result").innerHTML = "<p>連携が成功しました！「2」のボタンを押してください。</p>";
}

// 2. Spotifyのログインボタンが押されたときの処理
document.getElementById("loginBtn").addEventListener("click", () => {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=playlist-modify-public`;
    window.location.href = authUrl; // Spotifyのログイン画面に飛ばす
});

// 3. 「いまの天気から曲を生成」ボタンが押されたときの処理
document.getElementById("getWeatherBtn").addEventListener("click", async () => {
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${WEATHER_API_KEY}&units=metric`;

    try {
        // ① 天気データの取得
        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();
        const weather = weatherData.weather[0].main; // 例: Clear, Rain, Clouds
        const temp = weatherData.main.temp;

        // ② 天気に応じた曲の雰囲気（パラメータ）を決定する【ここがオリジナリティ！】
        let targetVolume = 0.5; // 曲の明るさ (0.0 〜 1.0)
        let targetEnergy = 0.5; // 曲の激しさ (0.0 〜 1.0)
        let seedGenres = "pop"; // 音楽ジャンル

        if (weather === "Clear") {
            targetVolume = 0.8; // 晴れなら明るく！
            targetEnergy = 0.8; // テンション高め！
            seedGenres = "pop,dance";
        } else if (weather === "Rain") {
            targetVolume = 0.2; // 雨ならしっとり
            targetEnergy = 0.3; // 落ち着いた曲
            seedGenres = "acoustic,chill";
        } else if (weather === "Clouds") {
            targetVolume = 0.5;
            targetEnergy = 0.5;
            seedGenres = "indie,ambient";
        }

        // ③ Spotify APIでおすすめの曲を取得する
        const spotifyUrl = `https://api.spotify.com/v1/recommendations?limit=5&seed_genres=${seedGenres}&target_valence=${targetVolume}&target_energy=${targetEnergy}`;
        
        const spotifyResponse = await fetch(spotifyUrl, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const spotifyData = await spotifyResponse.json();

        // ④ 画面に結果を表示する
        let htmlContent = `
            <h3>現在の京都の天気: ${weather} (${temp}度)</h3>
            <p>おすすめの5曲を選びました：</p>
            <ul>
        `;

        // 取得した曲の一覧をループ処理でHTMLにする
        spotifyData.tracks.forEach(track => {
            htmlContent += `<li><strong>${track.name}</strong> - ${track.artists[0].name}</li>`;
        });
        htmlContent += "</ul>";

        document.getElementById("result").innerHTML = htmlContent;

    } catch (error) {
        console.error("エラーが発生しました", error);
        document.getElementById("result").innerHTML = "<p>データの取得に失敗しました。</p>";
    }
});
