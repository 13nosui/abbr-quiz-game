export default async function handler(req, res) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "No API Key configured" });

    // Vercelの10秒制限対策で3問に設定
    const prompt = `
    あなたはクイズ作成AIです。
    「略語の正式名称クイズ」または「業界用語の意味クイズ」を新しく3問作成し、JSON配列形式で出力してください。
    【条件】
    1. 一般的な略語、ビジネス用語、IT用語、若者言葉、業界隠語などからランダムに選ぶこと。
    2. 回答は必ず有効なJSON配列のみを出力すること。Markdown記号や解説文は含めないでください。
    3. フォーマット: [{"abbr": "略語", "formal": ["正解1"], "level": 1}]
    `;

    // 【修正点】確実に動作する最新モデルのみに絞る
    // gemini-pro (旧モデル) は削除しました
    const models = ['gemini-1.5-flash', 'gemini-1.5-pro'];

    for (const model of models) {
        try {
            // v1betaエンドポイントを使用
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Gemini API Error (${model}):`, errorText);
                continue;
            }

            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            
            console.log(`Raw Gemini Response (${model}):`, rawText);

            const jsonMatch = rawText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                console.error("JSON array not found in response");
                continue;
            }

            const quizData = JSON.parse(jsonMatch[0]);
            return res.status(200).json(quizData);

        } catch (e) {
            console.error(`Attempt failed with ${model}:`, e);
            continue;
        }
    }
    
    // 全モデル失敗した場合
    return res.status(500).json({ 
        error: "AI generation failed. Please check Vercel Logs for API errors." 
    });
}
