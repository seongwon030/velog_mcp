// MCP Apps 미리보기 카드를 외부 URL 없는 단일 HTML로 묶는다.
// 브라우저 의존성(ext-apps, marked)은 devDependencies라 여기서 번들에 포함시킨다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import { build } from "esbuild";

const root = new URL("../", import.meta.url);
const uiDir = new URL("ui/", root);
const outFile = new URL("dist/ui/draft-preview.html", root);

const result = await build({
  entryPoints: [fileURLToPath(new URL("draft-preview.ts", uiDir))],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  minify: true,
  legalComments: "none",
  write: false,
  logLevel: "warning",
});

// 인라인 <script> 안에서 `</script`나 `<!--`가 HTML 파서 상태를 바꾸지 않도록
// `<`를 `\x3C`로 바꾼다. 이 시퀀스는 문자열·정규식 리터럴 안에만 나오므로 의미가
// 같다. 혹시 코드 자체가 깨졌다면 아래 구문 검사에서 빌드를 멈춘다.
const script = result.outputFiles[0].text.replace(
  /<(?=!--|\/script)/gi,
  "\\x3C",
);
// 실행하지 않고 컴파일만 한다.
new Script(script, { filename: "draft-preview.js" });

const [template, style] = await Promise.all([
  readFile(new URL("draft-preview.html", uiDir), "utf8"),
  readFile(new URL("draft-preview.css", uiDir), "utf8"),
]);

// 치환 문자열의 `$&` 같은 패턴이 해석되지 않도록 함수 치환을 쓴다.
const html = template
  .replace("/*__STYLE__*/", () => style)
  .replace("/*__SCRIPT__*/", () => script);

await mkdir(new URL("./", outFile), { recursive: true });
await writeFile(outFile, html);
console.log(
  `dist/ui/draft-preview.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`,
);
