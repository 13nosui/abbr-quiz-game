export default async function handler(req, res) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "No API Key configured" });

    const prompt = `
    あなたはクイズ作成AIです。
    「略語の正式名称クイズ」または「業界用語の意味クイズ」を新しく5問作成し、JSON配列形式で出力してください。
    【条件】
    1. 一般的な略語、ビジネス用語、IT用語、若者言葉、業界隠語などからランダムに選ぶこと。
    2. 回答は必ず有効なJSON配列のみを出力すること。
    3. フォーマット: [{"abbr": "略語", "formal": ["正解1"], "level": 1}]
    `;

    const models = ['gemini-1.5-flash', 'gemini-pro', 'gemini-1.0-pro-latest'];

    for (const model of models) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!response.ok) continue;

            const data = await response.json();
            let text = data.candidates[0].content.parts[0].text;
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();

            return res.status(200).json(JSON.parse(text));
        } catch (e) {
            console.error(e);
            continue;
        }
    }
    return res.status(500).json({ error: "AI generation failed" });
}
