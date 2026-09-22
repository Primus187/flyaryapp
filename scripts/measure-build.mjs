import fs from "node:fs";
import zlib from "node:zlib";

const html = fs.readFileSync("dist/index.html", "utf8");
const names = [...new Set([...html.matchAll(/(?:src|href)="\/(assets\/[^" ]+\.js)"/g)].map((match) => match[1]))];
const files = names.map((name) => {
  const content = fs.readFileSync(`dist/${name}`);
  return { name, bytes: content.length, gzipBytes: zlib.gzipSync(content).length };
});
const sw = fs.readFileSync("dist/sw.js", "utf8");
const report = {
  measuredAt: new Date().toISOString(),
  initialScripts: files,
  initialGzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
  analysisReportPrecached: sw.includes('url:"stats.html"'),
  analysisReportBytes: fs.existsSync("dist/stats.html") ? fs.statSync("dist/stats.html").size : 0,
  note: "Static HTML entry/preload JS only; selected-language and route chunks are loaded additionally. Gzip is simulated, not a mobile network timing.",
};
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
