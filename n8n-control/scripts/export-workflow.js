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

function sanitizeFileName(name) {
    return String(name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\- ]+/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase();
}

async function main() {
    loadEnv();

    const workflowId = process.argv[2];
    if (!workflowId) {
        throw new Error('Uso: node scripts/export-workflow.js <workflowId>');
    }

    const baseUrl = process.env.N8N_BASE_URL;
    const apiKey = process.env.N8N_API_KEY;

    if (!baseUrl) throw new Error('Falta N8N_BASE_URL en .env');
    if (!apiKey) throw new Error('Falta N8N_API_KEY en .env');

    const url = `${baseUrl}/api/v1/workflows/${workflowId}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'X-N8N-API-KEY': apiKey,
            'Content-Type': 'application/json',
        },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error ${res.status} al obtener workflow:\n${text}`);
    }

    const workflow = await res.json();

    const safeName = sanitizeFileName(workflow.name || `workflow-${workflowId}`);
    const outDir = path.join(process.cwd(), 'workflows', 'raw');
    const outPath = path.join(outDir, `${safeName}.raw.json`);

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(outPath, JSON.stringify(workflow, null, 2), 'utf8');

    console.log(`Exportado en: ${outPath}`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});