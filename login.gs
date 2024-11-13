const WEBHOOK_URL = "******"; // ご自身のウェブフックURLに置き換えてください
const CLIENT_ID = "***";
const CLIENT_SECRET = "**";

function getAccessToken() {
  const tokenResponse = UrlFetchApp.fetch("https://api.intra.42.fr/oauth/token", {
    "method": "post",
    "payload": {
      "grant_type": "client_credentials",
      "client_id": CLIENT_ID,
      "client_secret": CLIENT_SECRET
    }
  });
  
  const tokenData = JSON.parse(tokenResponse.getContentText());
  return tokenData.access_token; // access_tokenを返す
}

function getProjectInfo() {
  const accessToken = getAccessToken();
  const users = ["**","**"];//知りたい人のintra名を入れる
  const results = [];

  users.forEach((user, index) => {
    const options = {
      method: 'get',
      headers: {
        Authorization: 'Bearer ' + accessToken
      },
      muteHttpExceptions: true // エラーレスポンスも取得する
    };

    // ユーザー情報を取得
    const response = UrlFetchApp.fetch(`https://api.intra.42.fr/v2/users/${user}/locations`, options);
    const code = response.getResponseCode();

    if (code === 200) {
      const locations = JSON.parse(response.getContentText());
      if (locations.length > 0 && locations[0].end_at === null) {
        const location = locations[0];
        const beginAt = location.begin_at ? new Date(location.begin_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : null;
        const now = Math.floor(Date.now() / 1000);
        const elapsedTime = location.begin_at ? Math.floor((now - new Date(location.begin_at).getTime() / 1000) / 60) : "N/A";

        // 6分以内のユーザー情報のみ追加
        if (elapsedTime <= 5 && elapsedTime !== "N/A") {
          results.push({
            user: user,
            location: location.host,
            begin_at: beginAt,
            elapsed_time: `${Math.floor(elapsedTime / 60)}時間 ${elapsedTime % 60}分`
          });
        }
      }
    } else if (code === 429) {
      Logger.log("リクエストが制限されました。しばらく待機します。");
      Utilities.sleep(60000); // 60秒待機
      return; // 終了し、次のユーザーを処理する
    } else {
      Logger.log(`ユーザー ${user} の情報取得中にエラーが発生しました: ${response.getContentText()}`);
    }

    Utilities.sleep(1000); // 各リクエストの間に1秒待機
  });

  return results;
}

function sendToDiscord(data) {
  // 整形されたテキストを作成
  let content = "";

  data.forEach(userInfo => {
    content += `${userInfo.user}が来たよ‼️！\n`;
    content += `    場所　　: ${userInfo.location}\n\n\n\n\n`;
  });

  const payload = {
    content: content.trim() // 余分な空白を削除
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  };

  UrlFetchApp.fetch(WEBHOOK_URL, options);
}


function main() {
  const projectInfo = getProjectInfo();
  if (projectInfo.length > 0) {
    sendToDiscord(projectInfo);
  } else {
    Logger.log("取得した情報がありません。");
  }
}
