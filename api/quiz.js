// api/quiz.js
// サーバー側で安全にAPIキーを使うためのコード

export default async function handler(req, res) {
    // Vercelの環境変数からキーを取得（コードには書かない！）
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "API Key not configured on server" });
    }

    // AIへの命令文
    const prompt = `
    あなたはクイズ作成AIです。
    「略語の正式名称クイズ」または「業界用語の意味クイズ」を新しく5問作成し、JSON配列形式で出力してください。
    
    【条件】
    1. 一般的な略語、ビジネス用語、IT用語、若者言葉、業界隠語などからランダムに選ぶこと。
    2. 回答は必ず有効なJSON配列のみを出力すること（Markdownのbacktickなどは不要）。
    3. フォーマット:
    [
      { "abbr": "略語または用語", "formal": ["正式名称1", "正式名称2"], "level": 1〜3の難易度 }
    ]
    `;

    // 複数のモデルで試行するロジック
    const models = ['gemini-1.5-flash', 'gemini-pro', 'gemini-1.0-pro'];
    
    for (const model of models) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!response.ok) continue; // 失敗したら次のモデルへ

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text
                .replace(/```json/g, '').replace(/```/g, '').trim();
            
            // 成功したらデータを返して終了
            const questions = JSON.parse(text);
            return res.status(200).json(questions);

        } catch (e) {
            console.error(`Model ${model} failed:`, e);
            continue;
        }
    }

    // 全部失敗した場合
    return res.status(500).json({ error: "Failed to generate quiz" });
}
