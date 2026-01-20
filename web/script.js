// SmartHVAC Studio — Commercial-Grade Client
// Follows 5-Layer Architecture -> Layer 1 (Frontend) & Layer 2 (Firebase Coordination)

import { firebaseConfig } from "./firebaseConfig.js";

// Firebase SDKs are loaded via CDN in HTML
firebase.initializeApp(firebaseConfig);

// Firestore & Storage
const db = firebase.firestore();
const storage = firebase.storage();

console.log("Firebase initialized (5-Layer Architecture Mode)");

// ----------------------------
// TEST: Firestore write
// ----------------------------
function testFirestoreWrite() {
  db.collection("test_connectivity").add({
    message: "SmartHVAC Studio connected",
    timestamp: new Date()
  })
    .then(() => {
      alert("Firestore connection successful!");
    })
    .catch((error) => {
      console.error("Firestore error:", error);
      alert("Firestore error: " + error.message);
    });
}

// ----------------------------
// Create a new Job (Layer 1 -> Layer 2)
// ----------------------------
function submitDescription() {

  const input = document.getElementById("description");
  if (!input || input.value.trim() === "") {
    alert("Please enter a description.");
    return;
  }

  // Exact Data Model from Architecture PDF
  const jobData = {
    status: "queued",
    nlpInputText: input.value,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),

    // Placeholders for Layer 3 (Colab) to fill
    idfFilePath: null,
    weatherFilePath: null,
    simulationConfig: JSON.parse(localStorage.getItem("smartHVAC_config") || "{}"),
    resultPath: null,
    errorMessage: null
  };

  // Generate Custom ID: "job_YYYYMMDD_HHMMSS"
  const now = new Date();
  const timestampId = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + "_" +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');

  const customJobId = `job_${timestampId}`;

  // Use set() with custom ID instead of add()
  db.collection("jobs").doc(customJobId).set(jobData)
    .then(() => {
      const statusMsg = document.getElementById("statusMsg");
      if (statusMsg) {
        statusMsg.innerText = `Job submitted! ID: ${customJobId} (Waiting for Colab)`;
        statusMsg.style.color = "green";
      }
      input.value = ""; // Clear input
      // If we are on the results page or dashboard, refresh list
      if (typeof loadJobs === "function") {
        loadJobs();
      }
    })
    .catch((error) => {
      console.error("Job creation failed:", error);
      const statusMsg = document.getElementById("statusMsg");
      if (statusMsg) {
        statusMsg.innerText = "Error submitting job: " + error.message;
        statusMsg.style.color = "red";
      }
    });
}

// ----------------------------
// Load all Jobs (Status Polling)
// ----------------------------
function loadJobs() {

  const tableBody = document.getElementById("runsTable");
  if (!tableBody) return;

  // Clear current list
  tableBody.innerHTML = "";

  db.collection("jobs")
    .orderBy("createdAt", "desc")
    .limit(10) // Keep UI clean
    .onSnapshot((snapshot) => {
      // Real-time listener (better than manual polling)
      tableBody.innerHTML = ""; // Clear again for update

      snapshot.forEach((doc) => {
        const data = doc.data();
        const row = document.createElement("tr");

        // Row styling based on status
        let statusColor = "black";
        if (data.status === "running") statusColor = "orange";
        if (data.status === "done") statusColor = "green";
        if (data.status === "error") statusColor = "red";

        row.innerHTML = `
              <td>${data.nlpInputText ? data.nlpInputText.substring(0, 50) + "..." : "No description"}</td>
              <td style="color: ${statusColor}; font-weight: bold;">${data.status}</td>
              <td>${data.createdAt ? data.createdAt.toDate().toLocaleString() : "Just now"}</td>
            `;

        // Click to show details
        row.onclick = () => showJobDetails(doc.id, data);
        row.style.cursor = "pointer";

        tableBody.appendChild(row);
      });
    }, (error) => {
      console.error("Error loading jobs:", error);
      const autoMsg = document.getElementById("autoMsg");
      if (autoMsg) autoMsg.innerText = "Error syncing jobs.";
    });
}

// ----------------------------
// Show Job Details & Results
// ----------------------------
function showJobDetails(jobId, data) {
  // Fill text details
  const elDesc = document.getElementById("detailDescription");
  const elStatus = document.getElementById("detailStatus");
  const elTime = document.getElementById("detailTime");
  const elPath = document.getElementById("detailPath"); // Re-purposed for ID/Path

  if (elDesc) elDesc.innerText = data.nlpInputText;
  if (elStatus) elStatus.innerText = data.status;
  if (elTime) elTime.innerText = data.createdAt ? data.createdAt.toDate().toLocaleString() : "-";
  if (elPath) elPath.innerText = data.resultPath || "Waiting...";

  // Handle Results Visualization
  const container = document.getElementById("resultsContainer"); // Make sure HTML has this
  const imgInfo = document.getElementById("zonePlot");
  const msgInfo = document.getElementById("zonePlotMsg");

  if (!imgInfo) return;

  if (data.status === "done") {
    // Load real results from Storage
    const plotPath = `results/${jobId}/zone_plot.png`;
    msgInfo.innerText = "Loading plot from: " + plotPath;

    storage.ref(plotPath).getDownloadURL()
      .then((url) => {
        imgInfo.src = url;
        msgInfo.innerText = "";
        imgInfo.style.display = "block";
      })
      .catch((e) => {
        console.log("No plot found yet:", e);
        imgInfo.style.display = "none";
        msgInfo.innerText = "Plot pending or not generated.";
      });
  } else if (data.status === "error") {
    imgInfo.style.display = "none";
    msgInfo.innerText = "Job failed: " + (data.errorMessage || "Unknown error");
    msgInfo.style.color = "red";
  } else {
    imgInfo.style.display = "none";
    msgInfo.innerText = "Simulation in progress... (" + data.status + ")";
    msgInfo.style.color = "gray";
  }
}

// ----------------------------
// Auto-Init on Page Load
// ----------------------------
window.addEventListener("load", () => {
  // If we are on the results page, load jobs immediately
  if (document.getElementById("runsTable")) {
    loadJobs();
  }
});

// Expose functions to global scope for HTML onclick
window.testFirestoreWrite = testFirestoreWrite;
window.submitDescription = submitDescription;
window.loadRuns = loadJobs; // Alias for backward compatibility if HTML buttons haven't changed yet
