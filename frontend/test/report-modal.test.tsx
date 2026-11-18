import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: "http://localhost:5173",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  Node: dom.window.Node,
  Element: dom.window.Element,
  HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
  Event: dom.window.Event,
  localStorage: dom.window.localStorage,
  IS_REACT_ACT_ENVIRONMENT: true,
});

test("question report modal: opens, selects reason, inputs suggested answer and submits", async () => {
  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { QuestionReportButton } = await import("../src/report-modal");

  const calls: { url: string; method: string; body: any }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method || "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, method, body });
    return new Response(JSON.stringify({ ok: true, id: "report-123" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const rootEl = dom.window.document.getElementById("root")!;
    const root = createRoot(rootEl);

    // 1. Render QuestionReportButton
    await act(async () => {
      root.render(
        <QuestionReportButton
          context={{
            examId: "exam-1",
            examTitle: "Đề thi thử THPT Quốc Gia",
            questionLabel: "Câu 5",
            questionPromptText: "Gia tốc rơi tự do tại mặt đất là bao nhiêu?",
          }}
        />,
      );
    });

    // Verify trigger button is rendered
    const triggerBtn = rootEl.querySelector(".question-report-trigger-btn") as HTMLButtonElement;
    assert.ok(triggerBtn, "Report trigger button should be rendered");

    // Modal should not be open yet
    assert.equal(rootEl.querySelector(".report-modal-backdrop"), null);

    // 2. Click trigger button to open modal
    await act(async () => {
      triggerBtn.click();
    });

    const modal = rootEl.querySelector(".report-modal-backdrop");
    assert.ok(modal, "Modal should be opened");

    // Verify title and subtitle
    const title = rootEl.querySelector("#report-modal-title");
    assert.equal(title?.textContent, "Báo lỗi câu hỏi");
    const subtitle = rootEl.querySelector(".report-subtitle");
    assert.ok(subtitle?.textContent?.includes("Câu 5"));

    // Verify question snippet preview
    const preview = rootEl.querySelector(".preview-text");
    assert.ok(preview?.textContent?.includes("Gia tốc rơi tự do"));

    // 3. Select reason "unclear_explanation" (Giải thích chưa hợp lý)
    const chips = rootEl.querySelectorAll(".report-reason-chip");
    assert.equal(chips.length, 5, "Should render 5 reason option chips");

    const explanationChip = Array.from(chips).find((c) =>
      c.textContent?.includes("Giải thích chưa hợp lý"),
    ) as HTMLButtonElement;
    assert.ok(explanationChip);

    await act(async () => {
      explanationChip.click();
    });
    assert.ok(explanationChip.classList.contains("active"));

    // 4. Fill in suggested answer
    const answerInput = rootEl.querySelector("#report-suggested-answer") as HTMLInputElement;
    assert.ok(answerInput);
    await act(async () => {
      const inputSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")?.set;
      inputSetter?.call(answerInput, "Phương án C (9.8 m/s²)");
      answerInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });

    // 5. Fill in message
    const messageTextarea = rootEl.querySelector("#report-message-text") as HTMLTextAreaElement;
    assert.ok(messageTextarea);
    await act(async () => {
      const areaSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value")?.set;
      areaSetter?.call(messageTextarea, "Lời giải ghi 10 m/s² nhưng đề bài không cho g = 10.");
      messageTextarea.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });

    // 6. Submit the form
    const form = rootEl.querySelector(".report-form") as HTMLFormElement;
    assert.ok(form);

    await act(async () => {
      form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    });

    // Verify API call was made to /api/reports
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/reports");
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].body.exam_id, "exam-1");
    assert.equal(calls[0].body.question_label, "Câu 5");
    assert.equal(calls[0].body.reason, "unclear_explanation");
    assert.equal(calls[0].body.suggested_answer, "Phương án C (9.8 m/s²)");
    assert.equal(
      calls[0].body.message,
      "Lời giải ghi 10 m/s² nhưng đề bài không cho g = 10.",
    );

    // Verify success state is displayed
    const successBox = rootEl.querySelector(".report-success-state");
    assert.ok(successBox, "Success state should be displayed after submit");
    assert.ok(successBox.textContent?.includes("Đã gửi phản ánh thành công"));

    root.unmount();
  } finally {
    globalThis.fetch = originalFetch;
  }
});
