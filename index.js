const express = require("express");
const cors = require("cors");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(cors());

// CONFIGURAÇÃO
const PORT = process.env.PORT || 7000;
const CSV_FILE = "bancodedadosfilmes.csv";
const THUMB_BASE_URL = "https://torrentbrabo.rf.gd/thumbs/";
const PAGE_SIZE = 90; // Define o número de filmes por página

// MANIFESTO DO ADDON
const manifest = {
    id: "br.gamesbrabo.addon",
    version: "1.0.4", // Versão final com todas as correções
    logo: "https://torrentbrabo.rf.gd/img/logo01.png",
    name: "Filmes BRabo",
    description: "Addon que fornece filmes via magnet links",
    resources: ["catalog", "meta", "stream"],
    types: ["movie"],
    idPrefixes: ["gbr-"],
    catalogs: [
        {
            id: "catalogo",
            type: "movie",
            name: "Filmes BRabo",
            // INFORMA AO Stremio que este catálogo suporta 'skip' (paginação)
            extra: [{ name: "skip", isRequired: false }] 
        }
    ]
};

let filmes = [];

/* ===========================================
    FUNÇÕES DE UTILIDADE
=========================================== */

/* Função para extrair infohash de um link magnet (Usada na rota /stream) */
function extractInfoHash(magnet) {
    try {
        // Expressão regular robusta para capturar o info hash (40 caracteres hexadecimais)
        const match = magnet.match(/btih:([A-Fa-f0-9]{40})/i); 
        return match ? match[1].toUpperCase() : null;
    } catch {
        return null;
    }
}

/* ===========================================
    VERIFICAÇÃO E CARREGAMENTO DO CSV
=========================================== */

if (!fs.existsSync(CSV_FILE)) {
    console.error("❌ ERRO FATAL: Arquivo CSV não encontrado!");
    console.error("📄 Caminho esperado:", path.join(__dirname, CSV_FILE));
    process.exit(1);
}

console.log("\n📄 Iniciando leitura do CSV...");

function carregarCSV() {
    return new Promise((resolve) => {
        fs.createReadStream(CSV_FILE, { encoding: "utf-8" })
            .pipe(csv())
            .on("data", (row) => {
                try {
                    // Garante que o link magnet existe e começa com "magnet:"
                    if (!row.title || !row.thumb || !row.url || !row.url.toLowerCase().startsWith("magnet:")) {
                        // Linhas de log detalhadas removidas para otimização
                        return;
                    }

                    const id = "gbr-" + crypto.createHash("sha1").update(row.title).digest("hex");

                    filmes.push({
                        id,
                        name: row.title.trim(),
                        poster: THUMB_BASE_URL + encodeURIComponent(row.thumb.trim()),
                        magnet: row.url.trim()
                    });

                } catch (err) {
                    console.log("❌ Erro ao processar linha:", err);
                }
            })
            .on("end", () => {
                console.log(`✔ CSV carregado com ${filmes.length} filmes.\n`);
                resolve();
            });
    });
}

/* ===========================================
    ROTAS DO ADDON
=========================================== */

/* MANIFEST */
app.get("/manifest.json", (req, res) => {
    console.log("📡 Manifest solicitado.");
    res.json(manifest);
});

// *** ROTA CATÁLOGO (CORRIGIDA PARA PAGINAÇÃO) ***
app.get("/catalog/:type/:id/:extra?.json", (req, res) => {
    console.log("📡 Catálogo solicitado.");

    let skip = 0;

    // Tenta extrair o skip do parâmetro 'extra' (ex: /skip=100.json)
    if (req.params.extra) {
        const skipMatch = req.params.extra.match(/skip=(\d+)/); 
        if (skipMatch) {
            skip = parseInt(skipMatch[1]);
        }
    }
    
    // Calcula o início e o fim do bloco de filmes
    const start = skip;
    const end = skip + PAGE_SIZE;

    // Obtém o bloco de filmes
    const filmesDaPagina = filmes.slice(start, end);
    
    console.log(`Página solicitada: skip=${skip}. Enviando ${filmesDaPagina.length} filmes.`);

    const metas = filmesDaPagina.map(f => ({
        id: f.id,
        type: "movie",
        name: f.name,
        poster: f.poster
    }));

    // Se a página estiver vazia e não for a primeira, o Stremio sabe que acabou
    if (filmesDaPagina.length === 0 && start > 0) {
        console.log("✔ Fim do catálogo atingido.");
    }

    res.json({ metas });
});

/* METADATA INDIVIDUAL */
app.get("/meta/:type/:id.json", (req, res) => {
    const id = req.params.id;
    console.log(`📡 Metadata solicitada para ID: ${id}`);

    const item = filmes.find(f => f.id === id);

    if (!item) {
        console.log("❌ Metadata NÃO encontrada.");
        return res.json({ meta: {} });
    }

    res.json({
        meta: {
            id: item.id,
            type: "movie",
            name: item.name,
            poster: item.poster,
            background: item.poster,
            description: "Filme do catálogo Filmes BRabo.",
            year: "2024" // Boa prática para Stremio
        }
    });
});

/* STREAM (CORRIGIDO E OTIMIZADO) */
app.get("/stream/:type/:id.json", (req, res) => {
    const id = req.params.id;

    console.log("\n———————— STREAM REQUEST ————————");
    console.log("🔎 ID solicitado:", id);

    const item = filmes.find(f => f.id === id);

    if (!item || !item.magnet) {
        console.log("❌ ERRO: filme ou magnet NÃO encontrado!");
        return res.json({ streams: [] });
    }

    console.log("🎬 Filme:", item.name);
    console.log("🔗 MAGNET ENVIADO:", item.magnet); 

    res.json({
        streams: [
            {
                name: "FilmesBRabo",
                title: "Reproduzir via Magnet",
                url: item.magnet,
                infoHash: extractInfoHash(item.magnet), 
                behaviorHints: {
                    notWebReady: true
                }
            }
        ]
    });

    console.log("✔ Stream enviado com sucesso!");
});

/* ===========================================
    INÍCIO DO SERVIDOR
=========================================== */

async function iniciar() {
    await carregarCSV();

    app.listen(PORT, () => {
        console.log("🚀 Addon FilmesBRabo rodando na porta " + PORT);
        console.log(`🔗 Manifesto: http://localhost:${PORT}/manifest.json`);
    });
}

iniciar();
