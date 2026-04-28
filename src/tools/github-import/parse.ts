export interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
}

export function parseFrontMatter(content: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: content };

  const [, yaml, body] = match;
  const data: Record<string, unknown> = {};

  const yamlLines = yaml.split("\n");
  let i = 0;
  while (i < yamlLines.length) {
    const line = yamlLines[i];
    const keyOnly = line.match(/^([\w-]+):\s*$/);
    if (keyOnly) {
      const key = keyOnly[1];
      const items: string[] = [];
      i++;
      while (i < yamlLines.length && yamlLines[i].match(/^\s+-\s+/)) {
        items.push(
          yamlLines[i]
            .replace(/^\s+-\s+/, "")
            .replace(/^['"]|['"]$/g, "")
            .trim(),
        );
        i++;
      }
      if (items.length > 0) data[key] = items;
      continue;
    }

    const kv = line.match(/^([\w-]+):\s*(.+)$/);
    if (kv) {
      const [, key, value] = kv;
      const clean = value.trim().replace(/^['"]|['"]$/g, "");
      if (clean.startsWith("[") && clean.endsWith("]")) {
        data[key] = clean
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
          .filter(Boolean);
      } else {
        data[key] = clean;
      }
    }
    i++;
  }

  return { data, body: body.trim() };
}

export function rewriteImageUrls(
  body: string,
  repo: string,
  branch: string,
  filePath: string,
): string {
  const baseDir = filePath.includes("/")
    ? filePath.slice(0, filePath.lastIndexOf("/"))
    : "";
  const rawBase = `https://raw.githubusercontent.com/${repo}/${branch}`;

  return body.replace(
    /!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
    (_, alt, src) => {
      const trimmed = src.trim();
      let resolved: string;
      if (trimmed.startsWith("/")) {
        resolved = `${rawBase}${trimmed}`;
      } else {
        const relative = trimmed.replace(/^\.\//, "");
        resolved = baseDir
          ? `${rawBase}/${baseDir}/${relative}`
          : `${rawBase}/${relative}`;
      }
      return `![${alt}](${resolved})`;
    },
  );
}
