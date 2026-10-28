import { App } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { renderMarkdown, safeImageSrc, safeLinkHref } from "./markdown.js";
import { sanitizeHtml } from "./sanitize.js";

interface Draft {
  draft_id: string;
  title: string;
  body: string;
  tags: string[];
  is_private: boolean;
  short_description: string | null;
  thumbnail: string | null;
  series_id: string | null;
}

type PublishState = "idle" | "confirm" | "publishing" | "done";

const PUBLISH_LABEL = "발행하기";
const CONFIRM_LABEL = "정말 공개로 발행할까요? 한 번 더 누르세요";
// 더블클릭이나 Enter 키 반복으로 확인 단계를 건너뛰지 않도록, 확인 상태로 바뀐 뒤
// 이 시간 안에 들어온 클릭은 무시한다. 키보드 클릭은 event.detail이 0이라 시간으로 막는다.
const CONFIRM_DELAY_MS = 800;

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} 요소가 없습니다.`);
  return el;
}

const statusEl = $("status");
const cardEl = $("card");
const titleEl = $("title");
const metaEl = $("meta");
const tagsEl = $("tags");
const descEl = $("description");
const thumbEl = $("thumbnail") as HTMLImageElement;
const bodyEl = $("body");
const publishBtn = $("publish") as HTMLButtonElement;
const publishMsg = $("publish-message");
const resultEl = $("result");
const choiceInputs = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="visibility"]'),
);

let draft: Draft | null = null;
let state: PublishState = "idle";
let confirmSince = 0;
// 마지막으로 불러오기 시작한 draft_id. 같은 tool-result가 다시 와도 무시한다.
let requestedDraftId: string | null = null;

const app = new App({ name: "velog-draft-preview", version: "1.0.0" });

function textOf(result: CallToolResult): string {
  const first = result.content?.[0];
  return first && first.type === "text" ? first.text : "";
}

function showStatus(message: string, isError = false): void {
  statusEl.textContent = message;
  statusEl.hidden = message === "";
  statusEl.classList.toggle("error", isError);
}

function isPrivateChoice(): boolean {
  return choiceInputs.find((i) => i.checked)?.value !== "public";
}

function setState(next: PublishState): void {
  state = next;
  if (next === "confirm") confirmSince = performance.now();
  const locked = next === "publishing" || next === "done";
  publishBtn.disabled = locked;
  for (const input of choiceInputs) input.disabled = locked;
  publishBtn.classList.toggle("confirm", next === "confirm");
  publishBtn.textContent =
    next === "confirm"
      ? CONFIRM_LABEL
      : next === "publishing"
        ? "발행 중..."
        : next === "done"
          ? "발행 완료"
          : PUBLISH_LABEL;
}

function renderDraft(d: Draft): void {
  draft = d;
  titleEl.textContent = d.title;

  metaEl.replaceChildren();
  const visibility = document.createElement("span");
  visibility.className = "badge";
  visibility.textContent = `초안 기본값: ${d.is_private ? "비공개" : "공개"}`;
  metaEl.append(visibility);
  if (d.series_id) {
    const series = document.createElement("span");
    series.className = "badge";
    series.textContent = `시리즈 ${d.series_id}`;
    metaEl.append(series);
  }

  tagsEl.replaceChildren(
    ...d.tags.map((tag) => {
      const el = document.createElement("span");
      el.className = "tag";
      el.textContent = `#${tag}`;
      return el;
    }),
  );
  tagsEl.hidden = d.tags.length === 0;

  descEl.textContent = d.short_description ?? "";
  descEl.hidden = !d.short_description;

  const thumb = d.thumbnail ? safeImageSrc(d.thumbnail) : null;
  thumbEl.hidden = !thumb;
  if (thumb) thumbEl.src = thumb;
  else thumbEl.removeAttribute("src");

  // renderMarkdown이 raw HTML을 이스케이프하고 URL 스킴을 걸러내며,
  // sanitizeHtml(DOMPurify)이 허용한 태그·속성만 남긴다.
  bodyEl.innerHTML = sanitizeHtml(renderMarkdown(d.body));

  for (const input of choiceInputs) {
    input.checked = (input.value === "private") === d.is_private;
  }
  publishMsg.textContent = "";
  resultEl.replaceChildren();
  setState("idle");
  showStatus("");
  cardEl.hidden = false;
}

async function openUrl(url: string): Promise<void> {
  try {
    const { isError } = await app.openLink({ url });
    if (isError) showStatus(`링크를 열 수 없습니다: ${url}`, true);
  } catch (e) {
    showStatus(`링크를 열 수 없습니다: ${(e as Error).message}`, true);
  }
}

async function loadDraft(draftId: string): Promise<void> {
  requestedDraftId = draftId;
  showStatus("초안을 불러오는 중...");
  cardEl.hidden = true;
  try {
    const result = await app.callServerTool({
      name: "velog_get_draft",
      arguments: { draft_id: draftId },
    });
    // 기다리는 사이 다른 초안 요청이 시작됐으면 늦게 온 응답은 버린다.
    if (requestedDraftId !== draftId) return;
    if (result.isError) {
      requestedDraftId = null;
      showStatus(textOf(result) || "초안을 불러오지 못했습니다.", true);
      return;
    }
    renderDraft(JSON.parse(textOf(result)) as Draft);
  } catch (e) {
    if (requestedDraftId !== draftId) return;
    requestedDraftId = null;
    showStatus(`초안을 불러오지 못했습니다: ${(e as Error).message}`, true);
  }
}

// 카드에서 한 발행은 대화 기록에 남지 않는다. 호스트가 다음 사용자 메시지와 함께
// 모델에 넘기도록 알려서, 모델이 이미 발행된 초안을 다시 발행하려 하지 않게 한다.
async function reportPublished(
  d: Draft,
  isPrivate: boolean,
  post: { post_id: string; url: string },
): Promise<void> {
  if (!app.getHostCapabilities()?.updateModelContext) return;
  const scope = isPrivate ? "비공개" : "공개";
  try {
    await app.updateModelContext({
      content: [
        {
          type: "text",
          text: `사용자가 미리보기 카드에서 초안 "${d.title}"(draft_id: ${d.draft_id})을 ${scope}로 발행했습니다. post_id: ${post.post_id}, URL: ${post.url}. 이 초안은 이미 발행되어 다시 발행할 수 없습니다.`,
        },
      ],
    });
  } catch {
    // 알림 실패는 발행 결과에 영향을 주지 않는다.
  }
}

async function publish(d: Draft): Promise<void> {
  const isPrivate = isPrivateChoice();
  setState("publishing");
  publishMsg.textContent = "";
  publishMsg.classList.remove("error");
  try {
    const result = await app.callServerTool({
      name: "velog_publish_post",
      arguments: { draft_id: d.draft_id, is_private: isPrivate },
    });
    if (result.isError) {
      publishMsg.textContent = textOf(result) || "발행에 실패했습니다.";
      publishMsg.classList.add("error");
      setState("idle");
      return;
    }
    const post = JSON.parse(textOf(result)) as { post_id: string; url: string };
    const { url } = post;
    setState("done");
    void reportPublished(d, isPrivate, post);
    publishMsg.textContent =
      "발행했습니다. Velog 페이지 반영까지 1~2분 걸릴 수 있어 링크가 바로 열리지 않으면 잠시 뒤 다시 열어 주세요.";
    const safe = safeLinkHref(url);
    if (safe) {
      const link = document.createElement("button");
      link.type = "button";
      link.className = "link";
      link.textContent = safe;
      link.addEventListener("click", () => void openUrl(safe));
      resultEl.replaceChildren(link);
    }
  } catch (e) {
    publishMsg.textContent = `발행 요청이 실패했습니다: ${(e as Error).message}`;
    publishMsg.classList.add("error");
    setState("idle");
  }
}

// Enter·Space를 누르고 있으면 브라우저가 반복 keydown마다 click을 만든다.
// 키보드 click은 detail이 0이라 시간 조건만으로는 걸러지지 않으므로 반복을 막는다.
publishBtn.addEventListener("keydown", (event) => {
  if (event.repeat && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
  }
});

publishBtn.addEventListener("click", () => {
  if (!draft || state === "publishing" || state === "done") return;
  if (!isPrivateChoice()) {
    if (state === "idle") {
      setState("confirm");
      return;
    }
    // 더블클릭의 두 번째 click도 이 시간 안에 들어온다.
    if (performance.now() - confirmSince < CONFIRM_DELAY_MS) return;
  }
  void publish(draft);
});

for (const input of choiceInputs) {
  input.addEventListener("change", () => {
    if (state === "confirm") setState("idle");
  });
}

// velog CDN 밖의 썸네일은 CSP에 막히므로 깨진 이미지 대신 숨긴다.
thumbEl.addEventListener("error", () => {
  thumbEl.hidden = true;
});

// 본문 링크는 iframe 안에서 이동하지 않고 호스트에게 열어 달라고 요청한다.
bodyEl.addEventListener("click", (event) => {
  const anchor = (event.target as Element | null)?.closest("a");
  if (!anchor) return;
  event.preventDefault();
  const safe = safeLinkHref(anchor.getAttribute("href") ?? "");
  if (safe) void openUrl(safe);
});

app.ontoolresult = (result) => {
  // 발행 중이거나 끝난 뒤 알림이 다시 오면 상태가 초기화되어 중복 발행이나
  // 결과 URL 유실로 이어지므로 무시한다.
  if (state === "publishing" || state === "done") return;
  if (result.isError) {
    showStatus(textOf(result) || "초안 생성에 실패했습니다.", true);
    return;
  }
  let draftId: unknown;
  try {
    draftId = (JSON.parse(textOf(result)) as { draft_id?: unknown }).draft_id;
  } catch {
    draftId = undefined;
  }
  if (typeof draftId !== "string") {
    showStatus("툴 결과에서 draft_id를 찾지 못했습니다.", true);
    return;
  }
  if (draftId === requestedDraftId) return;
  void loadDraft(draftId);
};

showStatus("초안 결과를 기다리는 중...");
app.connect().catch((e: Error) => {
  showStatus(`호스트와 연결하지 못했습니다: ${e.message}`, true);
});
