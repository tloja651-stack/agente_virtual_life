const fs = require('fs');
const path = require('path');

function patchNodeMetaverse() {
  const base = path.join(__dirname, 'node_modules', '@caspertech', 'node-metaverse', 'dist');
  if (!fs.existsSync(base)) {
    console.log('⚠️ node-metaverse ainda não encontrado para patch.');
    return;
  }

  const loginURI = process.env.LOGIN_URI || process.env.GRID_LOGIN_URI || 'http://www.alifevirtual.com:8002/';
  const viewerChannel = process.env.VIEWER_CHANNEL || 'Firestorm-Alife-Virtual';
  const viewerVersion = process.env.VIEWER_VERSION || '7.2.3.1';
  const viewerParts = viewerVersion.split('.');
  const viewerMajor = viewerParts[0] || '7';
  const viewerMinor = viewerParts[1] || '2';
  const viewerPatch = viewerParts[2] || '3';
  const viewerBuild = viewerParts[3] || '1';
  const viewerPlatform = process.env.VIEWER_PLATFORM || 'win';

  const files = [];
  function walk(dir) {
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (/\.(js|json|d\.ts)$/.test(full)) files.push(full);
    }
  }

  walk(base);

  for (const file of files) {
    let text = fs.readFileSync(file, 'utf8');
    const original = text;

    text = text.replace(/https:\/\/login\.agni\.lindenlab\.com\/cgi-bin\/login\.cgi/g, loginURI);
    const blockedViewerNames = [
      'Firestorm-' + 'HYDRA' + 'STORM',
      'Hydra' + 'Storm',
      'HYDRA' + 'STORM',
      'Dark' + 'storm',
      'Dark' + 'Storm',
      'Dark' + 'stone',
      'DARK' + 'STORM'
    ];

    for (const oldName of blockedViewerNames) {
      text = text.split(oldName).join(viewerChannel);
    }

    // Se a lib tiver campos padrão de channel/version, tenta atualizar também.
    text = text.replace(/(this\.channel\s*=\s*['"])[^'"]*(['"])/g, `$1${viewerChannel}$2`);
    text = text.replace(/(this\.version\s*=\s*['"])[^'"]*(['"])/g, `$1${viewerVersion}$2`);



    // Patch crítico: LoginHandler.js é quem monta o XML-RPC real do login.
    // A versão original envia channel='libnmv'. Algumas grids bloqueiam isso.
    if (file.endsWith('LoginHandler.js')) {
      text = text.replace(/channel:\s*['"]libnmv['"]/g, `channel: ${JSON.stringify(viewerChannel)}`);
      text = text.replace(/major,\s*\n\s*minor,\s*\n\s*patch,\s*\n\s*build,/g,
        `major: ${JSON.stringify(viewerMajor)},\n                        minor: ${JSON.stringify(viewerMinor)},\n                        patch: ${JSON.stringify(viewerPatch)},\n                        build: ${JSON.stringify(viewerBuild)},`);
      text = text.replace(/platform,\s*\n\s*version:\s*version\s*\+\s*['"]\.['"]\s*\+\s*build/g,
        `platform: ${JSON.stringify(viewerPlatform)},\n                        version: ${JSON.stringify(viewerVersion)}`);
      text = text.replace(/viewer_digest:\s*viewerDigest/g, "viewer_digest: viewerDigest");
    }

    // Patch específico para LoginParameters.js: força Login URI e identificação do viewer.
    if (file.endsWith(path.join('classes', 'LoginParameters.js'))) {
      text = text.replace(/this\.url\s*=\s*['"][^'"]*['"]\s*;/g, "this.url = process.env.LOGIN_URI || process.env.GRID_LOGIN_URI || 'http://www.alifevirtual.com:8002/';");
      if (!/this\.channel\s*=/.test(text)) {
        text = text.replace(/(this\.url\s*=\s*process\.env\.LOGIN_URI[^;]*;)/, "$1\n        this.channel = process.env.VIEWER_CHANNEL || 'Firestorm-Alife-Virtual';\n        this.version = process.env.VIEWER_VERSION || '7.2.3.1';\n        this.platform = process.env.VIEWER_PLATFORM || 'win';");
      }
      text = text.replace(/this\.channel\s*=\s*['"][^'"]*['"]\s*;/g, "this.channel = process.env.VIEWER_CHANNEL || 'Firestorm-Alife-Virtual';");
      text = text.replace(/this\.version\s*=\s*['"][^'"]*['"]\s*;/g, "this.version = process.env.VIEWER_VERSION || '7.2.3.1';");
      text = text.replace(/this\.platform\s*=\s*['"][^'"]*['"]\s*;/g, "this.platform = process.env.VIEWER_PLATFORM || 'win';");
    }

    if (text !== original) {
      fs.writeFileSync(file, text);
      console.log('✅ Patch aplicado em:', path.relative(__dirname, file));
    }
  }
}


patchNodeMetaverse();
