import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { DocumentsPage, formatFileSize } from "../src/documents";
import { DocumentItem } from "../src/types";

test("formatFileSize formats bytes correctly", () => {
  assert.equal(formatFileSize(0), "0 B");
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(1024), "1.0 KB");
  assert.equal(formatFileSize(2.5 * 1024 * 1024), "2.5 MB");
});

test("documents page: list, selection, batch bar, and preview modal", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "http://localhost:5173/documents",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });

  const sampleDocs: DocumentItem[] = [
    {
      id: "doc-1",
      title: "Sổ tay công thức Toán 12",
      description: "Tóm tắt Giải tích và Hình học",
      subject: "Toán học",
      grade: "12",
      category: "theory",
      file_name: "so-tay-toan-12.pdf",
      mime_type: "application/pdf",
      file_size: 1024 * 1024 * 2.5,
      views_count: 15,
      downloads_count: 5,
      status: "published",
      author_name: "Examsparty",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "doc-2",
      title: "Sơ đồ tư duy Vật lý 12",
      description: "Dao động cơ học và Sóng âm",
      subject: "Vật lý",
      grade: "12",
      category: "mindmap",
      file_name: "mindmap-vat-ly-12.pdf",
      mime_type: "application/pdf",
      file_size: 1024 * 500,
      views_count: 28,
      downloads_count: 12,
      status: "published",
      author_name: "Ban Chuyên Môn",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    let body: unknown = {};
    if (url.includes("/api/documents/subjects")) {
      body = {
        subjects: [
          { subject: "Toán học", count: 1 },
          { subject: "Vật lý", count: 1 },
        ],
      };
    } else if (url.includes("/api/documents")) {
      body = {
        items: sampleDocs,
        total: sampleDocs.length,
        page: 1,
      };
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const rootEl = dom.window.document.getElementById("root")!;
    const root = createRoot(rootEl);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/documents"]}>
          <DocumentsPage />
        </MemoryRouter>,
      );
    });

    // Wait for subjects to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // When no subject is selected, the Subject Selection Hub is displayed
    const subjectCards = rootEl.querySelectorAll(".subject-hub-card");
    assert.ok(subjectCards.length > 0, "Subject hub cards should be rendered initially");

    // Click on "Toán học" card to enter the horizontal documents view
    const mathCard = Array.from(subjectCards).find((el) =>
      el.textContent?.includes("Toán học"),
    ) as HTMLElement;
    assert.ok(mathCard, "Math subject card should exist");

    await act(async () => {
      mathCard.click();
    });

    // Wait for documents to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Verify horizontal document rows are rendered
    const rows = rootEl.querySelectorAll(".doc-horizontal-row");
    assert.equal(rows.length, 2, "Should render 2 document rows");

    const firstRowTitle = rootEl.querySelector(".doc-row-title");
    assert.equal(firstRowTitle?.textContent, "Sổ tay công thức Toán 12");

    // Initially batch bar should not be visible
    assert.equal(rootEl.querySelector(".doc-batch-bar"), null);

    // Click checkbox on first card to select
    const firstCheckbox = rootEl.querySelector(".doc-row-checkbox") as HTMLButtonElement;
    assert(firstCheckbox);
    await act(async () => {
      firstCheckbox.click();
    });

    // Batch bar should now appear
    const batchBar = rootEl.querySelector(".doc-batch-bar");
    assert(batchBar, "Batch bar should appear when items are selected");
    assert(batchBar.textContent?.includes("Đã chọn 1 tài liệu"));

    // Click "Xem trực tiếp" button on first card
    const previewBtn = rootEl.querySelector(".doc-action-btn") as HTMLButtonElement;
    assert(previewBtn);
    await act(async () => {
      previewBtn.click();
    });

    // Fullscreen Preview modal should be open
    const modal = rootEl.querySelector(".doc-fullscreen-overlay");
    assert(modal, "Fullscreen preview modal should open");
    const iframe = rootEl.querySelector(".doc-fullscreen-iframe") as HTMLIFrameElement;
    assert(iframe);
    assert(iframe.src.includes("/api/documents/doc-1/preview"));

    // Close modal via circular dark close button (X)
    const closeBtn = rootEl.querySelector(".doc-viewer-circle-close") as HTMLButtonElement;
    assert(closeBtn, "Circular close button should exist");
    await act(async () => {
      closeBtn.click();
    });

    assert.equal(rootEl.querySelector(".doc-fullscreen-overlay"), null);

    root.unmount();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("documents page: dynamically renders configured subjects from API", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "http://localhost:5173/documents",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });

  const customConfigured = [
    {
      id: "khtn",
      name: "Khoa học Tự nhiên",
      desc: "Tích hợp Lý, Hóa, Sinh",
      tone: "chemistry",
      icon: "Atom",
      active: true,
      count: 4,
    },
    {
      id: "ktpl",
      name: "Kinh tế & Pháp luật",
      desc: "Chương trình mới",
      tone: "amber",
      icon: "Scale",
      active: true,
      count: 2,
    },
    {
      id: "hidden-subj",
      name: "Môn Đang Ẩn",
      desc: "Không hiển thị cho học sinh",
      tone: "default",
      icon: "BookOpen",
      active: false,
      count: 0,
    },
  ];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/api/documents/subjects")) {
      return new Response(
        JSON.stringify({
          subjects: [
            { subject: "Khoa học Tự nhiên", count: 4 },
            { subject: "Kinh tế & Pháp luật", count: 2 },
          ],
          configured: customConfigured,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ items: [], total: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const rootEl = dom.window.document.getElementById("root")!;
    const root = createRoot(rootEl);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/documents"]}>
          <DocumentsPage />
        </MemoryRouter>,
      );
    });

    // Active subjects should be visible in Hub
    assert(rootEl.textContent?.includes("Khoa học Tự nhiên"));
    assert(rootEl.textContent?.includes("Kinh tế & Pháp luật"));
    // Hidden subject should NOT be visible
    assert(!rootEl.textContent?.includes("Môn Đang Ẩn"));

    root.unmount();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("documents page: groups documents into folders and supports Đại học grade", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "http://localhost:5173/documents?subject=To%C3%A1n%20h%E1%BB%8Dc",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });

  const folderDocs: DocumentItem[] = [
    {
      id: "doc-f1",
      title: "Bài 1: Tính đơn điệu",
      description: "Lý thuyết khảo sát hàm số",
      folder_name: "Chương 1 - Ứng dụng đạo hàm",
      subject: "Toán học",
      grade: "dai_hoc",
      category: "theory",
      file_name: "bai-1.pdf",
      mime_type: "application/pdf",
      file_size: 1024 * 1024,
      views_count: 10,
      downloads_count: 2,
      status: "published",
      author_name: "Examsparty",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "doc-f2",
      title: "Bài 2: Cực trị hàm số",
      description: "Các dạng bài tập cực trị",
      folder_name: "Chương 1 - Ứng dụng đạo hàm",
      subject: "Toán học",
      grade: "dai_hoc",
      category: "exercise",
      file_name: "bai-2.pdf",
      mime_type: "application/pdf",
      file_size: 1024 * 1024 * 1.5,
      views_count: 12,
      downloads_count: 4,
      status: "published",
      author_name: "Examsparty",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "doc-single",
      title: "Đề thi thử tổng hợp",
      description: "Đề thi riêng lẻ không nằm trong thư mục",
      folder_name: null,
      subject: "Toán học",
      grade: "12",
      category: "exercise",
      file_name: "de-thi.pdf",
      mime_type: "application/pdf",
      file_size: 1024 * 500,
      views_count: 30,
      downloads_count: 15,
      status: "published",
      author_name: "Examsparty",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/api/documents/subjects")) {
      return new Response(JSON.stringify({ subjects: [{ subject: "Toán học", count: 3 }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/documents")) {
      return new Response(JSON.stringify({ items: folderDocs, total: 3, page: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };

  try {
    const rootEl = dom.window.document.getElementById("root")!;
    const root = createRoot(rootEl);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/documents?subject=To%C3%A1n%20h%E1%BB%8Dc"]}>
          <DocumentsPage />
        </MemoryRouter>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Verify "Đại học" grade pill is present in toolbar
    const gradePills = Array.from(rootEl.querySelectorAll(".grade-pill"));
    const uniPill = gradePills.find((p) => p.textContent?.trim() === "Đại học");
    assert.ok(uniPill, "Toolbar must include 'Đại học' grade pill");

    // Verify folder card is rendered rather than exploding everything flatly
    const folderCard = rootEl.querySelector(".doc-folder-card");
    assert.ok(folderCard, "Should render a folder card grouping documents");
    assert(folderCard.textContent?.includes("Chương 1 - Ứng dụng đạo hàm"));
    assert(folderCard.textContent?.includes("2 bài học"));

    // Verify "Tải cả thư mục (.ZIP)" button exists on folder
    const folderDlBtn = folderCard.querySelector(".doc-folder-dl-btn");
    assert.ok(folderDlBtn, "Folder card should offer a 1-click batch download (.ZIP) button");

    // Initially the folder is collapsed, clicking header expands it
    const folderHeader = folderCard.querySelector(".doc-folder-header") as HTMLElement;
    assert.ok(folderHeader);

    await act(async () => {
      folderHeader.click();
    });

    // After expanding, the 2 nested document rows are visible
    const nestedRows = folderCard.querySelectorAll(".doc-horizontal-row.nested");
    assert.equal(nestedRows.length, 2, "Folder should expand to show its 2 lessons");

    // Check that folder card shows "Đại học" and nested rows cleanly display title & source
    assert(folderCard.textContent?.includes("Đại học"));
    assert(nestedRows[0].textContent?.includes("Bài 1: Tính đơn điệu"));
    assert(nestedRows[0].textContent?.includes("Examsparty"));

    // Standalone document should also be rendered separately
    const standaloneRow = rootEl.querySelector(".doc-horizontal-row:not(.nested)");
    assert.ok(standaloneRow, "Standalone document should be rendered outside the folder");
    assert(standaloneRow.textContent?.includes("Đề thi thử tổng hợp"));

    root.unmount();
  } finally {
    globalThis.fetch = originalFetch;
  }
});
