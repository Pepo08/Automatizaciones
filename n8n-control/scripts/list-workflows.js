const fs = require('fs');
const path = require('path');

function loadEnv(filePath = path.join(process.cwd(), '.env')) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`No existe el archivo .env en: ${filePath}`);
    }

    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;

        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        process.env[key] = value;
    }
}

async function main() {
    loadEnv();

    const baseUrl = process.env.N8N_BASE_URL;
    const apiKey = process.env.N8N_API_KEY;

    if (!baseUrl) throw new Error('Falta N8N_BASE_URL en .env');
    if (!apiKey) throw new Error('Falta N8N_API_KEY en .env');

    const url = `${baseUrl}/api/v1/workflows`;

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'X-N8N-API-KEY': apiKey,
            'Content-Type': 'application/json',
        },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error ${res.status} al listar workflows:\n${text}`);
    }

    const data = await res.json();
    const workflows = data.data || data.items || data;

    console.log(JSON.stringify(workflows, null, 2));
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});