// SmartHVAC Studio — Safe Firebase Client
// No secrets stored in this file

import { firebaseConfig } from "./firebaseConfig.js";

// Firebase SDKs are loaded via CDN in HTML
firebase.initializeApp(firebaseConfig);

// Firestore & Storage
const db = firebase.firestore();
const storage = firebase.storage();

console.log("Firebase initialized safely");

// ----------------------------
// TEST: Firestore write
// ----------------------------
function testFirestoreWrite() {
  db.collection("test_runs").add({
    message: "SmartHVAC Studio connected",
    timestamp: new Date()
  })
  .then(() => {
    alert("Firestore connection successful!");
  })
  .catch((error) => {
    console.error("Firestore error:", error);
  });
}

// ----------------------------
// Create a new run from NLP input
// ----------------------------
function submitDescription() {

  const input = document.getElementById("description");
  if (!input || input.value.trim() === "") {
    alert("Please enter a description.");
    return;
  }

  db.collection("runs").add({
    description: input.value,
    status: "pending",
    created_at: new Date()
  })
  .then((docRef) => {
    const resultsPath = `results/${docRef.id}/`;

    return db.collection("runs").doc(docRef.id).update({
      results_path: resultsPath
    });
  })
  .then(() => {
    document.getElementById("statusMsg").innerText =
      "Run created successfully (pending).";
  })
  .catch((error) => {
    console.error("Run creation failed:", error);
  });
}

// ----------------------------
// Load all runs
// ----------------------------
function loadRuns() {

  const tableBody = document.getElementById("runsTable");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  db.collection("runs")
    .orderBy("created_at", "desc")
    .get()
    .then((snapshot) => {

      snapshot.forEach((doc) => {
        const data = doc.data();

        const row = document.createElement("tr");
        row.onclick = () => showRunDetails(doc.id);

        row.innerHTML = `
          <td>${data.description}</td>
          <td>${data.status}</td>
          <td>${data.created_at
            ? data.created_at.toDate().toLocaleString()
            : "-"}</td>
        `;

        tableBody.appendChild(row);
      });

    })
    .catch(err => console.error("Load runs failed:", err));
}

// ----------------------------
// Auto refresh
// ----------------------------
function startAutoRefresh() {
  loadRuns();
  setInterval(loadRuns, 30000);
}

// ----------------------------
// Show run details
// ----------------------------
function showRunDetails(runId) {

  db.collection("runs").doc(runId).get()
    .then((doc) => {
      if (!doc.exists) return;

      const data = doc.data();

      document.getElementById("detailDescription").innerText = data.description;
      document.getElementById("detailStatus").innerText = data.status;
      document.getElementById("detailTime").innerText =
        data.created_at
          ? data.created_at.toDate().toLocaleString()
          : "-";
      document.getElementById("detailPath").innerText =
        data.results_path || "-";
    });

  loadZonePlot(runId);
}

// ----------------------------
// Load result plot
// ----------------------------
function loadZonePlot(runId) {

  const img = document.getElementById("zonePlot");
  const msg = document.getElementById("zonePlotMsg");

  if (!img) return;

  const path = `results/${runId}/zone_plot.png`;
  msg.innerText = "Loading plot...";

  storage.ref(path).getDownloadURL()
    .then((url) => {
      img.src = url;
      msg.innerText = "";
    })
    .catch(() => {
      img.src = "";
      msg.innerText = "Plot not available yet.";
    });
}

// ----------------------------
// Page load
// ----------------------------
window.addEventListener("load", () => {
  if (document.getElementById("runsTable")) {
    startAutoRefresh();
  }
});

// Expose functions to HTML
window.testFirestoreWrite = testFirestoreWrite;
window.submitDescription = submitDescription;
