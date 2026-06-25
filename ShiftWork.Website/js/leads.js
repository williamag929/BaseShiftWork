/* ============================================================
   ShiftWork — leads.js
   Lightweight customer-lead tracker. Reads demo requests saved
   by the marketing site (localStorage "shiftwork_leads"),
   supports status updates, CSV export, and deletion.
   ============================================================ */

const LEADS_KEY = "shiftwork_leads";
const STATUSES = ["New", "Contacted", "Customer"];

const body = document.getElementById("leadsBody");
const emptyState = document.getElementById("leadsEmpty");
const table = document.getElementById("leadsTable");

function getLeads() {
  try {
    return JSON.parse(localStorage.getItem(LEADS_KEY)) || [];
  } catch {
    return [];
  }
}

function setLeads(leads) {
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}

function statusClass(status) {
  switch (status) {
    case "Contacted": return "status-contacted";
    case "Customer": return "status-customer";
    default: return "status-new";
  }
}

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function render() {
  const leads = getLeads();

  document.getElementById("countTotal").textContent = leads.length;
  document.getElementById("countNew").textContent = leads.filter((l) => (l.status || "New") === "New").length;
  document.getElementById("countContacted").textContent = leads.filter((l) => l.status === "Contacted").length;
  document.getElementById("countCustomer").textContent = leads.filter((l) => l.status === "Customer").length;

  emptyState.hidden = leads.length > 0;
  table.style.display = leads.length ? "" : "none";

  body.innerHTML = leads
    .map((lead) => {
      const status = lead.status || "New";
      const options = STATUSES.map(
        (s) => `<option value="${s}" ${s === status ? "selected" : ""}>${s}</option>`
      ).join("");
      return `
        <tr data-id="${escapeHtml(lead.id)}">
          <td>${formatDate(lead.createdAt)}</td>
          <td><strong>${escapeHtml(lead.name)}</strong></td>
          <td>${escapeHtml(lead.company)}</td>
          <td>${escapeHtml(lead.email)}${lead.phone ? "<br />" + escapeHtml(lead.phone) : ""}</td>
          <td>${escapeHtml(lead.industry)}</td>
          <td>${escapeHtml(lead.teamSize)}</td>
          <td>${escapeHtml(lead.message || "—")}</td>
          <td>
            <span class="lead-status ${statusClass(status)}">${status}</span><br />
            <select class="status-select" data-action="status" aria-label="Update status">${options}</select>
          </td>
          <td><button class="btn-danger-link" data-action="delete" type="button">Delete</button></td>
        </tr>`;
    })
    .join("");
}

body.addEventListener("change", (e) => {
  if (e.target.dataset.action !== "status") return;
  const id = e.target.closest("tr").dataset.id;
  const leads = getLeads();
  const lead = leads.find((l) => String(l.id) === id);
  if (lead) {
    lead.status = e.target.value;
    setLeads(leads);
    render();
  }
});

body.addEventListener("click", (e) => {
  if (e.target.dataset.action !== "delete") return;
  const row = e.target.closest("tr");
  const id = row.dataset.id;
  if (!confirm("Delete this lead? This cannot be undone.")) return;
  setLeads(getLeads().filter((l) => String(l.id) !== id));
  render();
});

document.getElementById("clearBtn").addEventListener("click", () => {
  if (!getLeads().length) return;
  if (!confirm("Delete ALL leads? This cannot be undone.")) return;
  setLeads([]);
  render();
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const leads = getLeads();
  if (!leads.length) {
    alert("No leads to export yet.");
    return;
  }
  const cols = ["createdAt", "name", "company", "email", "phone", "industry", "teamSize", "message", "status"];
  const csvCell = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const csv = [
    cols.join(","),
    ...leads.map((l) => cols.map((c) => csvCell(l[c])).join(",")),
  ].join("\r\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `shiftwork-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

render();
