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

// Manifest do addon
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

if (!fs.existsSync(CSV_FILE)) {
    console.log("❌ Arquivo CSV não encontrado:", path.join(__dirname, CSV_FILE));
    process.exit(1);
}

console.log("📄 Lendo CSV...");

fs.createReadStream(CSV_FILE, { encoding: "utf-8" })
  .pipe(csv())
  .on("data", (row) => {
      if (row.title && row.thumb && row.url) {
          // monta URL absoluta da thumb
          // encodeURIComponent para evitar problema com espaços, acentos, etc.
          const thumbFile = row.thumb.trim();
          const thumbUrl = THUMB_BASE_URL + encodeURIComponent(thumbFile);

          filmes.push({
              id: "gbr-" + Buffer.from(row.title).toString("hex"),
              name: row.title.trim(),
              poster: thumbUrl,
              magnet: row.url.trim()
          });
      }
  })
  .on("end", () => {
      console.log("✔ CSV carregado com", filmes.length, "filmes.");
  });

// manifest
app.get("/manifest.json", (req, res) => {
    res.json(manifest);
});

// catálogo
app.get("/catalog/:type/:id.json", (req, res) => {
    const metas = filmes.map(f => ({
        id: f.id,
        type: "movie",
        name: f.name,
        poster: f.poster
    }));

    res.json({ metas });
});

// metadata
app.get("/meta/:type/:id.json", (req, res) => {
    const item = filmes.find(f => f.id === req.params.id);
    if (!item) return res.json({ meta: {} });

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

// stream
app.get("/stream/:type/:id.json", (req, res) => {
    const item = filmes.find(f => f.id === req.params.id);
    if (!item) return res.json({ streams: [] });

    res.json({
        streams: [
            {
                title: "Magnet",
                url: item.magnet
            }
        ]
    });
});

app.listen(PORT, () => {
  console.log("Addon rodando na porta " + PORT);
});
