// --- 核心：検索と表示（ジャンル廃止・完全天気お任せ版） ---
async function searchMusic(weatherUrl) {
    const accessToken = localStorage.getItem("spotify_access_token");
    try {
        const wRes = await fetch(weatherUrl);
        const wData = await wRes.json();
        if (wData.cod !== 200) throw new Error("都市が見つかりません");

        const weather = wData.weather[0].main;
        const temp = Math.round(wData.main.temp);

        // 🌟 天気と気温から、AIに渡すジャンルと数値を全自動で決定！
        let targetValence = 0.5;
        let targetEnergy = 0.5;
        let seedGenre = "pop";

        if (weather === "Clear") {
            if (temp >= 26) { targetValence = 0.8; targetEnergy = 0.8; seedGenre = "summer,pop"; }
            else if (temp >= 15) { targetValence = 0.7; targetEnergy = 0.6; seedGenre = "acoustic,pop"; }
            else { targetValence = 0.6; targetEnergy = 0.4; seedGenre = "acoustic,chill"; }
        } else if (weather === "Rain") {
            targetValence = 0.3; targetEnergy = 0.3; seedGenre = "rainy-day,piano";
        } else if (weather === "Clouds") {
            targetValence = 0.5; targetEnergy = 0.4; seedGenre = "indie,chill";
        } else if (weather === "Snow") {
            targetValence = 0.4; targetEnergy = 0.2; seedGenre = "ambient,piano";
        }

        currentPlaylistName = `Weather: ${wData.name} (${temp}℃ / ${weather})`;
        
        // Recommendations API で検索
        const recUrl = `${BASE_API_URL}/recommendations?limit=5&seed_genres=${seedGenre}&target_valence=${targetValence}&target_energy=${targetEnergy}`;
        
        const sRes = await fetch(recUrl, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        const sData = await sRes.json();

        if (sData.error) throw new Error(`Spotifyエラー: ${sData.error.message}`);

        // 画面の表示からもジャンル表記を削除し、スッキリさせる
        let html = `<h4>☁️ ${wData.name}: ${temp}℃ (${weather})</h4>`;
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
            html += `<button id="playlistBtn" class="btn" style="background:#1DB954; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;" onclick="savePlaylist(this)">💾 プレイリストを保存</button>`;
        } else {
            html += "<p>条件に合う曲が見つかりませんでした。</p>";
        }
        
        document.getElementById("result").innerHTML = html;

    } catch (e) { alert(e.message); }
}
