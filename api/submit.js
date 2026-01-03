export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { genreKey, genreName, colorPrimary, colorBg, questions } = req.body;
  const token = process.env.GITHUB_TOKEN;
  const owner = '13nosui'; // あなたのユーザー名
  const repo = 'abbr-quiz-game'; // リポジトリ名

  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN is missing' });

  const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
  };

  try {
      // 1. 現在のindex.htmlを取得
      const fileRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/index.html`, { headers });
      if (!fileRes.ok) throw new Error('Failed to fetch index.html');
      const fileData = await fileRes.json();
      
      let content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      const sha = fileData.sha;

      // 2. コンテンツの注入
      
      // CSS変数の追加
      content = content.replace(/(:root\s*\{[^}]*)/, `$1\n            --${genreKey}-primary: ${colorPrimary}; --${genreKey}-bg: ${colorBg};`);
      
      // Bodyクラスの追加
      content = content.replace(/(\/\* モードスタイル \*\/)/, `$1\n        body.${genreKey}-mode { background-color: var(--${genreKey}-bg); --primary-color: var(--${genreKey}-primary); }`);
      
      // ボタンクラスの追加
      content = content.replace(/(<\/style>)/, `        .btn-${genreKey} { background-color: ${colorPrimary}; }\n    $1`);
      
      // メニューボタンの追加（「クイズを作る」ボタンの後ろに追加されるよう調整、または特定位置に追加）
      // ここでは「ギャル語」メニューの直前などをターゲットにしています
      const newButton = `<button class="menu-btn btn-${genreKey}" onclick="startSpecialGame('${genreKey}')">\n                <div class="menu-btn-content"><span>🆕 ${genreName}</span><span class="menu-desc">ユーザー投稿</span></div><span>▶</span>\n            </button>`;
      content = content.replace(/(<div id="gal-era-select")/, `${newButton}\n            $1`);

      // データの追加 【重要修正：$1の直後にカンマを追加】
      const newQs = questions.map(q => `        { abbr: "${q.abbr}", formal: ${JSON.stringify(q.formal)}, type: '${genreKey}', level: ${q.level||1} },`).join('\n');
      content = content.replace(
          /(const masterQuizData = \[\s*[\s\S]*?)(\];)/,
          `$1,\n        // ${genreName} (User Submitted)\n${newQs}\n    $2`
      );
      
      // 配色ロジックの追加
      content = content.replace(
          /(badge\.style\.background =[\s\S]*?)("#27ae60";)/,
          `$1(currentType==='${genreKey}')?"${colorPrimary}": \n            $2`
      );

      // 3. ブランチ作成
      const branchName = `content/new-genre-${genreKey}-${Date.now()}`;
      const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/main`, { headers });
      const mainSha = (await refRes.json()).object.sha;
      
      await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
          method: 'POST', headers,
          body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: mainSha })
      });

      // 4. ファイル更新
      await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/index.html`, {
          method: 'PUT', headers,
          body: JSON.stringify({
              message: `feat: Add new genre "${genreName}"`,
              content: Buffer.from(content).toString('base64'),
              branch: branchName,
              sha: sha
          })
      });

      // 5. PR作成
      const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
          method: 'POST', headers,
          body: JSON.stringify({
              title: `✨ New Genre: ${genreName}`,
              head: branchName,
              base: 'main',
              body: `ユーザー投稿による新しいジャンル「${genreName}」の追加リクエストです。`
          })
      });
      const prData = await prRes.json();

      return res.status(200).json({ url: prData.html_url });

  } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
  }
}
