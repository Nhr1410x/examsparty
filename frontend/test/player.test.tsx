import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Player } from "../src/player";
import { ExamEditor } from "../src/contribution";
import { template } from "../src/types";
import { api } from "../src/api";

test("changing question before answering must not disable subsequent autosaves", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "http://localhost:5173",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const questions = ["q1", "q2"].map((client_id) => ({
    client_id,
    type: "single_choice",
    prompt: [{ type: "text", value: client_id }],
    options: [
      { id: "a", content: [{ type: "text", value: "A" }] },
      { id: "b", content: [{ type: "text", value: "B" }] },
    ],
    points: 1,
    explanation: [],
    tags: [],
    difficulty: "easy",
  }));
  const attempt = {
    id: "test-attempt",
    exam_id: "test-exam",
    mode: "practice",
    status: "active",
    started_at: new Date().toISOString(),
    expires_at: null,
    server_time: new Date().toISOString(),
    snapshot: { title: "Test", questions, settings: {} },
    responses: {},
    feedback: {},
    result: null,
  };
  const saves: string[] = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    if (options?.method === "PUT") {
      saves.push(url);
      const response = JSON.parse(String(options.body)).response;
      attempt.responses = {
        ...attempt.responses,
        [url.split("/").at(-1)!]: response,
      };
    }
    return new globalThis.Response(JSON.stringify(attempt), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/attempts/test-attempt"]}>
          <Routes>
            <Route path="/attempts/:id" element={<Player />} />
          </Routes>
        </MemoryRouter>,
      ),
    );
    const next = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Câu tiếp"),
    )!;
    await act(async () => next.click());
    const radio = document.querySelector(
      'input[name="answer-q2"]',
    ) as HTMLInputElement;
    assert.ok(radio, "Second question is displayed");
    await act(async () => radio.click());
    const prev = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Câu trước"),
    )!;
    await act(async () => prev.click());
    assert.ok(
      saves.includes("/api/attempts/test-attempt/answers/q2"),
      "Answer after an empty flush must reach the backend",
    );
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = oldFetch;
    dom.window.close();
  }
});

test("exam form reorders questions and preserves stable identifiers", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "http://localhost:5173",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const content = structuredClone(template);
  content.questions = [content.questions[0]];
  content.questions.push({
    ...structuredClone(content.questions[0]),
    client_id: "q2",
  });
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new globalThis.Response(JSON.stringify({ content }), { status: 200 });
  let raw = JSON.stringify(content);
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () =>
      root.render(<ExamEditor raw={raw} onChange={(next) => (raw = next)} />),
    );
    const formButton = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent === "Biểu mẫu",
    )!;
    await act(async () => formButton.click());
    const move = document.querySelector(
      'button[aria-label="Đưa câu q2 lên"]',
    ) as HTMLButtonElement;
    await act(async () => move.click());
    assert.deepEqual(
      JSON.parse(raw).questions.map((q: { client_id: string }) => q.client_id),
      ["q2", "q1"],
    );
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = oldFetch;
    dom.window.close();
  }
});

test("an expired exam retries automatic submission when connection returns", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "http://localhost:5173",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const attempt = {
    id: "timed",
    exam_id: "exam",
    mode: "exam",
    status: "active",
    started_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 100).toISOString(),
    server_time: new Date().toISOString(),
    snapshot: template,
    responses: {},
    feedback: {},
    result: null,
  };
  let submits = 0;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/submit")) {
      submits++;
      if (submits === 1) throw new TypeError("Offline");
    }
    return new globalThis.Response(JSON.stringify(attempt), { status: 200 });
  };
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/attempts/timed"]}>
          <Routes>
            <Route path="/attempts/:id" element={<Player />} />
            <Route
              path="/attempts/:id/results"
              element={<p>Results available</p>}
            />
          </Routes>
        </MemoryRouter>,
      ),
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 1100)));
    assert.equal(submits, 1);
    await act(async () => window.dispatchEvent(new dom.window.Event("online")));
    assert.equal(submits, 2);
    assert.match(document.body.textContent || "", /Results available/);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = oldFetch;
    dom.window.close();
  }
});

test("network failures have a readable recovery message", async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  try {
    await assert.rejects(api("/session"), /Không thể kết nối/);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
