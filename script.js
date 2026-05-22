// ① APIの設定（OpenWeatherMapの場合）
const API_KEY = "6569f9193b1871a2521eeb1bb5ffc92a";
const CITY = "Kyoto"; // 試しに京都に設定してみます

// ボタンが押されたときの処理
document.getElementById("getWeatherBtn").addEventListener("click", async () => {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${API_KEY}&units=metric`;

    try {
        // ② 天気データの取得（fetchを使ってAPIにお願いする）
        const response = await fetch(url);
        const data = await response.json();

        // ③ 必要な情報だけを抽出
        const weather = data.weather[0].main; // 天気
        const temp = data.main.temp;          // 気温

        // ④ 画面（HTML）に結果を書き込む
        const resultDiv = document.getElementById("result");
        resultDiv.innerHTML = `
            <p>現在の天気: <strong>${weather}</strong></p>
            <p>現在の気温: <strong>${temp}度</strong></p>
        `;
    } catch (error) {
        // エラーが起きたときの処理
        console.error("データの取得に失敗しました", error);
    }
});
