// markdown.test.ts와 sanitize.test.ts가 함께 쓰는 공격 입력.
// marked 18에서 inRawBlock 상태는 문단 경계에서 끝나지만, 바뀌어도 잡히도록
// 문단을 넘는 경우도 넣어 둔다.
export const RAW_BLOCK_PAYLOADS = [
  "좋은 글 <code> <img/src=x onerror=alert(1)>",
  "글 <pre> <img/src=x onerror=alert(1)>",
  "글 <kbd> <img/src=x onerror=alert(1)>",
  "글 <script> <img/src=x onerror=alert(1)>",
  "<code> 시작\n\n다음 문단 <img/src=x onerror=alert(1)> <svg/onload=alert(1)>",
  "문단 <code> 시작\n\n다음 문단 <img/src=x onerror=alert(1)>",
  "문단 <pre> 시작\n\n# 제목 <img/src=x onerror=alert(1)>\n\n- 목록 <img/src=x onerror=alert(1)>",
  "**굵게 <code>** _기울임 <img/src=x onerror=alert(1)>_",
  "[링크 <code>](https://a.com) <img/src=x onerror=alert(1)>",
  "- 항목 <pre>\n- <img/src=x onerror=alert(1)>",
  "| a | b |\n| - | - |\n| <code> | <img/src=x onerror=alert(1)> |",
  "x <?php <img/src=x onerror=alert(1)> ?>",
  "x <!-- <img/src=x onerror=alert(1)> -->",
  "x <![CDATA[ <img/src=x onerror=alert(1)> ]]>",
  "<!-- c -->\n<img src=x onerror=alert(1)>",
  "<?xml?>\n<svg onload=alert(1)>",
  "<![CDATA[x]]>\n<img src=x onerror=alert(1)>",
];

// 결정적인 의사 난수(mulberry32)로 퍼즈 입력을 만든다.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FRAGMENTS = [
  "<code>",
  "</code>",
  "<pre>",
  "</pre>",
  "<kbd>",
  "</kbd>",
  "<script>",
  "</script>",
  "<style>",
  "<img/src=x onerror=alert(1)>",
  "<img src=x onerror=alert(1)>",
  "<svg/onload=alert(1)>",
  "<a href=javascript:alert(1)>x</a>",
  "<iframe src=//evil>",
  "<b onclick=alert(1)>",
  "<!--",
  "-->",
  "<?",
  "?>",
  "<![CDATA[",
  "]]>",
  "<",
  ">",
  "/",
  "&",
  "&lt;",
  '"',
  "'",
  "`",
  "```",
  "*",
  "_",
  "~~",
  "[",
  "](",
  ")",
  "![",
  "](https://velog.velcdn.com/a.png)",
  "](javascript:alert(1))",
  "https://example.com",
  "\n",
  "\n\n",
  "- ",
  "1. ",
  "> ",
  "| a |",
  "# ",
  "    ",
  " ",
  "텍스트",
  "onerror=",
];

export function fuzzInputs(count: number, seed = 20261028): string[] {
  const rand = mulberry32(seed);
  const inputs: string[] = [];
  for (let i = 0; i < count; i++) {
    const length = 1 + Math.floor(rand() * 14);
    let s = "";
    for (let j = 0; j < length; j++) {
      s += FRAGMENTS[Math.floor(rand() * FRAGMENTS.length)];
    }
    inputs.push(s);
  }
  return inputs;
}
