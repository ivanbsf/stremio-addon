const express = require("express");
const cors = require("cors");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 7000;
const CSV_FILE = "bancodedadosfilmes.csv";

// domínio/base das imagens
const THUMB_BASE_URL = "https://torrentbrabo.rf.gd/thumbs/";

// Função para normalizar títulos (evita problemas no ID)
function normalizarTitulo(t) {
    return t
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "") // remove acentos
        .replace(/\s+/g, " ") // remove espaços duplos
        .trim();
}

// Manifest
const manifest = {
    id: "br.gamesbrabo.addon",
    version: "1.0.0",
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
            name: "Filmes BRabo"
        }
    ]
};

let filmes = [];

// Lê o CSV
if (!fs.existsSync(CSV_FILE)) {
    console.log("❌ CSV não encontrado:", path.join(__dirname, CSV_FILE));
    process.exit(1);
}

console.log("📄 Lendo CSV...");

fs.createReadStream(CSV_FILE)
    .pipe(csv())
    .on("data", (row) => {
        if (row.title && row.thumb && row.url) {

            const tituloOriginal = row.title.trim();
            const tituloNormalizado = normalizarTitulo(tituloOriginal);

            const idHex = Buffer.from(tituloNormalizado).toString("hex");

            const thumbUrl = THUMB_BASE_URL + encodeURIComponent(row.thumb.trim());

            filmes.push({
                id: "gbr-" + idHex,
                title: tituloOriginal,
                title_normalizado: tituloNormalizado,
                poster: thumbUrl,
                magnet: row.url.trim()
            });
        }
    })
    .on("end", () => {
        console.log("✔ CSV carregado:", filmes.length, "filmes");
    });


// Manifest
app.get("/manifest.json", (req, res) => res.json(manifest));


// Catálogo
app.get("/catalog/:type/:id.json", (req, res) => {
    const metas = filmes.map(f => ({
        id: f.id,
        type: "movie",
        name: f.title,
        poster: f.poster
    }));

    res.json({ metas });
});


// METADATA
app.get("/meta/:type/:id.json", (req, res) => {
    const item = filmes.find(f => f.id === req.params.id);

    if (!item) {
        console.log("❌ Meta não encontrada para ID:", req.params.id);
        return res.json({ meta: {} });
    }

    res.json({
        meta: {
            id: item.id,
            type: "movie",
            name: item.name,
            poster: item.poster,
            background: item.poster,
            description: "Filme do catálogo Filmes BRabo."
        }
    });
});

// STREAM
app.get("/stream/:type/:id.json", (req, res) => {
    const item = filmes.find(f => f.id === req.params.id);

    if (!item) {
        console.log("❌ Stream não encontrado para ID:", req.params.id);
        return res.json({ streams: [] });
    }
    console.log("🎬 Servindo magnet:", item.name);

    res.json({
        streams: [
            {
                name: "Torrent_BRabo",
                title: item.name,
                url: item.magnet,
                behaviorHints: {
                    notWebReady: true,
                    bingeGroup: "movies"
                }
            }
        ]
    });
});


app.listen(PORT, () => console.log("🔥 Addon rodando na porta " + PORT));


