import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { getCategory } from "./dreamCategories";
import { formatAmount, formatDateTime } from "./format";

const A5_WIDTH_PT = 420;
const A5_HEIGHT_PT = 595;

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildTaskListHtml(tasks, emptyText) {
  if (tasks.length === 0) {
    return `<p class="empty">${emptyText}</p>`;
  }
  return `<ul class="task-list">${tasks
    .map(
      (task) =>
        `<li>${task.isCompleted ? "☑" : "☐"} <span class="${
          task.isCompleted ? "task-done" : ""
        }">${escapeHtml(task.text)}</span></li>`
    )
    .join("")}</ul>`;
}

function buildNotesHtml(notes) {
  if (notes.length === 0) {
    return `<p class="empty">אין פתקים</p>`;
  }
  return notes
    .map(
      (note) => `
        <div class="note">
          <p class="note-text">${escapeHtml(note.text)}</p>
          <p class="note-date">${formatDateTime(note.date)}</p>
        </div>`
    )
    .join("");
}

function buildDreamHtml(dream) {
  const category = getCategory(dream.type);
  const percentage =
    dream.target > 0 ? Math.min(100, Math.round((dream.current / dream.target) * 100)) : 0;
  const remaining = Math.max(0, dream.target - dream.current);
  const tasks = dream.tasks ?? [];
  const notes = dream.notes ?? [];
  const openTasks = tasks.filter((task) => !task.isCompleted);
  const completedTasks = tasks.filter((task) => task.isCompleted);

  return `
    <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: 148mm 210mm; margin: 14mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, "Segoe UI", Arial, sans-serif;
            direction: rtl;
            color: #1A1A1A;
            background-color: #FFFFFF;
            margin: 0;
            padding: 0;
          }
          h1.title { font-size: 22px; font-weight: 700; margin: 0 0 6px; }
          .badge {
            display: inline-block;
            padding: 3px 10px;
            border: 1px solid ${category.color};
            color: ${category.color};
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
            margin-bottom: 18px;
          }
          .progress-track {
            width: 100%;
            height: 10px;
            border-radius: 999px;
            background-color: #EEF1F6;
            overflow: hidden;
            margin-bottom: 8px;
          }
          .progress-fill {
            height: 100%;
            border-radius: 999px;
            background-color: ${category.color};
            width: ${percentage}%;
          }
          .percentage { font-size: 12px; font-weight: 700; color: ${category.color}; margin: 0 0 16px; }
          .breakdown { border-top: 1px solid #E5E9F0; padding-top: 12px; margin-bottom: 22px; }
          .breakdown-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
          .breakdown-row .label { color: #6B7280; }
          .breakdown-row .value { font-weight: 600; }
          .remaining .value { color: ${category.color}; font-weight: 800; font-size: 15px; }
          h2 { font-size: 14px; margin: 18px 0 8px; }
          .task-list { list-style: none; padding: 0; margin: 0 0 8px; }
          .task-list li { font-size: 13px; margin-bottom: 6px; }
          .task-done { text-decoration: line-through; color: #9CA3AF; }
          .empty { font-size: 12px; color: #9CA3AF; margin: 0 0 8px; }
          .note {
            background-color: #F7F8FA;
            border: 1px solid #E5E9F0;
            border-radius: 10px;
            padding: 10px;
            margin-bottom: 10px;
          }
          .note-text { font-size: 13px; margin: 0 0 4px; }
          .note-date { font-size: 10px; color: #9CA3AF; margin: 0; }
          .footer { margin-top: 24px; font-size: 10px; color: #9CA3AF; text-align: center; }
        </style>
      </head>
      <body>
        <h1 class="title">${escapeHtml(dream.title)}</h1>
        <div class="badge">${category.label}</div>

        <div class="progress-track"><div class="progress-fill"></div></div>
        <p class="percentage">${percentage}% הושלם</p>

        <div class="breakdown">
          <div class="breakdown-row">
            <span class="label">יעד</span>
            <span class="value">${formatAmount(dream.target, dream.type)}</span>
          </div>
          <div class="breakdown-row">
            <span class="label">התקדמות נוכחית</span>
            <span class="value">${formatAmount(dream.current, dream.type)}</span>
          </div>
          <div class="breakdown-row remaining">
            <span class="label">מה נשאר כדי להגשים את החלום</span>
            <span class="value">${formatAmount(remaining, dream.type)}</span>
          </div>
        </div>

        <h2>משימות פתוחות</h2>
        ${buildTaskListHtml(openTasks, "אין משימות פתוחות")}
        <h2>משימות שהושלמו</h2>
        ${buildTaskListHtml(completedTasks, "אין משימות שהושלמו")}

        <h2>פתקים</h2>
        ${buildNotesHtml(notes)}

        <p class="footer">נוצר באמצעות מנהל החלומות · ${formatDateTime(new Date().toISOString())}</p>
      </body>
    </html>
  `;
}

export async function exportDreamToPDF(dream) {
  const html = buildDreamHtml(dream);

  const { uri } = await Print.printToFileAsync({
    html,
    width: A5_WIDTH_PT,
    height: A5_HEIGHT_PT,
    base64: false,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    alert("שיתוף אינו זמין במכשיר זה");
    return;
  }

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "שיתוף מחברת החלום",
    UTI: "com.adobe.pdf",
  });
}
