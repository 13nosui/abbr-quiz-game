import { Octokit } from '@octokit/rest';

const REPO_OWNER = '13nosui';
const REPO_NAME = 'abbr-quiz-game';
const MAIN_BRANCH = 'main';
const FILE_PATH = 'index.html';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Initialize Octokit
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
    }

    const octokit = new Octokit({ auth: token });

    // 2. Parse request body
    const { genreKey, genreName, colorPrimary, colorBg, questions } = req.body;

    if (!genreKey || !genreName || !colorPrimary || !colorBg || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    // 3. Fetch current index.html from main branch
    const { data: fileData } = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: FILE_PATH,
      ref: MAIN_BRANCH,
    });

    if (fileData.encoding !== 'base64') {
      return res.status(500).json({ error: 'Unexpected file encoding' });
    }

    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const baseSha = fileData.sha;

    // 4. Modify content
    let modifiedContent = currentContent;

    // 4a. Add CSS variables to :root (before closing brace)
    const cssVars = `            --${genreKey}-primary: ${colorPrimary}; --${genreKey}-bg: ${colorBg};\n`;
    if (!modifiedContent.includes(`--${genreKey}-primary`)) {
      const rootPattern = /(:root\s*\{[\s\S]*?)(\n\s*\})/;
      modifiedContent = modifiedContent.replace(rootPattern, (match, rootContent, closingBrace) => {
        return rootContent + cssVars + '        ' + closingBrace;
      });
    }

    // 4b. Add body class (after last body class)
    const bodyClass = `        body.${genreKey}-mode { background-color: var(--${genreKey}-bg); --primary-color: var(--${genreKey}-primary); }\n`;
    if (!modifiedContent.includes(`body.${genreKey}-mode`)) {
      const lastBodyClassPattern = /(body\.\w+-mode\s*\{[^}]*\}\s*\n)(\s*\.container)/;
      modifiedContent = modifiedContent.replace(lastBodyClassPattern, `$1${bodyClass}$2`);
    }

    // 4c. Add button class (after last button class)
    const buttonClass = `        .btn-${genreKey} { background-color: ${colorPrimary}; }\n`;
    if (!modifiedContent.includes(`.btn-${genreKey}`)) {
      const lastButtonClassPattern = /(\.btn-\w+\s*\{[^}]*\}\s*\n)(\s*\.play-mode-selector)/;
      modifiedContent = modifiedContent.replace(lastButtonClassPattern, `$1${buttonClass}$2`);
    }

    // 4d. Add menu button HTML (before gal-era-select div)
    const sampleAbbrs = questions.slice(0, Math.min(3, questions.length)).map(q => q.abbr).join('、');
    const menuButton = `            <button class="menu-btn btn-${genreKey}" onclick="startSpecialGame('${genreKey}')">
                <div class="menu-btn-content"><span>${genreName}</span><span class="menu-desc">${sampleAbbrs}${questions.length > 3 ? '...' : ''}</span></div><span>▶</span>
            </button>
`;
    if (!modifiedContent.includes(`btn-${genreKey}" onclick="startSpecialGame('${genreKey}')`)) {
      const galEraPattern = /(\s*)(<div id="gal-era-select")/;
      modifiedContent = modifiedContent.replace(galEraPattern, `${menuButton}$1$2`);
    }

    // 4e. Add quiz data to masterQuizData array (before closing bracket)
    const quizDataEntries = questions.map(q => {
      const formalArray = Array.isArray(q.formal) ? q.formal : [q.formal];
      const level = q.level || 1;
      // Escape quotes in strings
      const escapeQuotes = (str) => str.replace(/"/g, '\\"');
      return `        { abbr: "${escapeQuotes(q.abbr)}", formal: [${formalArray.map(f => `"${escapeQuotes(f)}"`).join(', ')}], type: '${genreKey}', level: ${level} }`;
    }).join(',\n');
    
    if (!modifiedContent.includes(`type: '${genreKey}'`)) {
      const dataArrayPattern = /(\];\s*\n\s*)(let currentPlayMode)/;
      modifiedContent = modifiedContent.replace(dataArrayPattern, `,\n        // ${genreName.toUpperCase()}\n${quizDataEntries}\n    $1$2`);
    }

    // 4f. Add color logic to showQuestion function (before default color)
    const colorLogic = `(currentType==='${genreKey}')?"${colorPrimary}": \n            `;
    if (!modifiedContent.includes(`(currentType==='${genreKey}')`)) {
      const defaultColorPattern = /((currentType==='\w+')?"#[0-9a-fA-F]+":\s*\n\s*)(\n\s*"#27ae60";)/;
      modifiedContent = modifiedContent.replace(defaultColorPattern, `$1${colorLogic}$2`);
    }

    // 5. Get main branch SHA for creating new branch
    const { data: mainBranch } = await octokit.repos.getBranch({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      branch: MAIN_BRANCH,
    });

    const timestamp = Date.now();
    const branchName = `content/new-genre-${genreKey}-${timestamp}`;

    // 6. Create new branch
    await octokit.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `refs/heads/${branchName}`,
      sha: mainBranch.commit.sha,
    });

    // 7. Commit changes
    const encodedContent = Buffer.from(modifiedContent, 'utf-8').toString('base64');

    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: FILE_PATH,
      message: `✨ Add new genre: ${genreName}`,
      content: encodedContent,
      branch: branchName,
      sha: baseSha,
    });

    // 8. Create Pull Request
    const { data: pr } = await octokit.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: `✨ New Genre: ${genreName}`,
      head: branchName,
      base: MAIN_BRANCH,
      body: `This PR adds a new quiz genre: **${genreName}**\n\n- Genre Key: \`${genreKey}\`\n- Primary Color: \`${colorPrimary}\`\n- Background Color: \`${colorBg}\`\n- Questions: ${questions.length}`,
    });

    // 9. Return PR URL
    return res.status(200).json({ url: pr.html_url });
  } catch (error) {
    console.error('Error creating PR:', error);
    return res.status(500).json({ 
      error: 'Failed to create pull request',
      details: error.message 
    });
  }
}

