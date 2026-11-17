import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { Admin } from "../src/admin";
import { template } from "../src/types";

test("admin selects exams, confirms deletion and retains selection on failure", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "http://localhost:5173/admin",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const originalFetch = globalThis.fetch;
  let exams = Array.from({ length: 12 }, (_, i) => ({
    id: `exam-${i}`,
    title: `De ${i}`,
    subject: "Toan",
    grade: "12",
    version: 1,
    status: "published",
    content: template,
  }));
  const deletions: string[][] = [];
  let confirmed = false,
    fail = false;
  const confirmations: string[] = [];
  dom.window.confirm = (message) => {
    confirmations.push(message);
    return confirmed;
  };
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    let body: unknown = {};
    let status = 200;
    if (url === "/api/session")
      body = {
        user: { id: "admin", email: "admin@example.com", role: "admin" },
      };
    else if (options?.method === "DELETE") {
      const { ids } = JSON.parse(String(options.body));
      deletions.push(ids);
      if (fail) {
        body = { error: "Xoa that bai" };
        status = 500;
      } else {
        exams = exams.filter((e) => !ids.includes(e.id));
        body = { deleted: ids.length };
      }
    } else if (url.startsWith("/api/admin/exams?")) body = { items: exams };
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
  const root = createRoot(document.getElementById("root")!);
  const button = (text: string) =>
    Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes(text),
    )!;
  const checks = () =>
    Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
  const click = async (element: HTMLElement) =>
    act(async () => element.click());
  try {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <Admin />
        </MemoryRouter>,
      ),
    );
    await click(button("Quản lý đề"));
    assert.equal(checks().length, 13, "One checkbox per exam and select all");
    assert.ok(button("Xóa đã chọn").disabled);
    await click(checks()[1]);
    await click(checks()[2]);
    await click(button("Xóa đã chọn"));
    assert.equal(
      deletions.length,
      0,
      "Cancelling confirmation sends no deletion",
    );
    assert.match(confirmations[0], /2/);
    confirmed = true;
    fail = true;
    await click(button("Xóa đã chọn"));
    assert.deepEqual(deletions[0], ["exam-0", "exam-1"]);
    assert.ok(
      checks()[1].checked && checks()[2].checked,
      "Failed deletion preserves selection",
    );
    assert.match(document.body.textContent || "", /Xoa that bai/);
    await click(checks()[0]);
    assert.ok(
      checks().every((c) => c.checked),
      "Select all checks current page",
    );
    await click(checks()[0]);
    assert.ok(
      checks().every((c) => !c.checked),
      "Select all can clear selection",
    );
    await click(checks()[1]);
    await act(async () =>
      document
        .querySelector("form.search-box")!
        .dispatchEvent(
          new dom.window.Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    assert.ok(
      checks().every((c) => !c.checked),
      "Searching clears selection",
    );
    await click(checks()[1]);
    await click(button("Sau"));
    assert.ok(
      checks().every((c) => !c.checked),
      "Changing page clears selection",
    );
    await click(checks()[1]);
    await click(button("Trước"));
    assert.ok(
      checks().every((c) => !c.checked),
      "Returning to a page does not restore selection",
    );
    await click(checks()[1]);
    await click(checks()[2]);
    fail = false;
    await click(button("Xóa đã chọn"));
    assert.deepEqual(deletions.at(-1), ["exam-0", "exam-1"]);
    assert.equal(
      document.querySelectorAll(".admin-list .review-item").length,
      10,
    );
    assert.ok(button("Xóa đã chọn").disabled);
    assert.ok(!document.querySelector('[aria-label="Chọn đề De 0"]'));
    assert.match(document.body.textContent || "", /Đã xóa 2 đề/);
    await click(checks()[0]);
    await click(button("Xóa đã chọn"));
    assert.equal(deletions.at(-1)!.length, 10);
    assert.equal(
      document.querySelectorAll(".admin-list .review-item").length,
      0,
    );
    assert.match(document.body.textContent || "", /Chưa có nội dung phù hợp/);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});
