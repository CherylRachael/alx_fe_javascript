// =======================
// Base Quotes Array
// =======================
let quotes = JSON.parse(localStorage.getItem("quotes")) || [
  { text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
  { text: "Don't let yesterday take up too much of today.", category: "Inspiration" }
];

let lastViewedQuote = sessionStorage.getItem("lastViewedQuote") || null;

// =======================
// DOM Elements
// =======================
const quoteDisplay = document.getElementById("quoteDisplay");
const categoryFilter = document.getElementById("categoryFilter");
const notification = document.createElement("div");
notification.id = "notification";
document.body.appendChild(notification);

// =======================
// Save Quotes to LocalStorage
// =======================
function saveQuotes() {
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

// =======================
// Show Random Quote
// =======================
function showQuote() {
  if (quotes.length === 0) {
    quoteDisplay.textContent = "No quotes available.";
    return;
  }
  const filteredQuotes = getFilteredQuotes();
  const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
  const quote = filteredQuotes[randomIndex];
  quoteDisplay.textContent = `"${quote.text}" — ${quote.category}`;
  sessionStorage.setItem("lastViewedQuote", quote.text);
}

// =======================
// Create Add Quote Form
// =======================
function createAddQuoteForm() {
  const form = document.createElement("form");
  form.innerHTML = `
    <input type="text" id="quoteText" placeholder="Quote" required />
    <input type="text" id="quoteCategory" placeholder="Category" required />
    <button type="submit">Add Quote</button>
  `;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    addQuote();
  });
  document.body.appendChild(form);
}

// =======================
// Add New Quote
// =======================
function addQuote() {
  const text = document.getElementById("quoteText").value.trim();
  const category = document.getElementById("quoteCategory").value.trim();
  if (text && category) {
    quotes.push({ text, category });
    saveQuotes();
    populateCategories();
    document.getElementById("quoteText").value = "";
    document.getElementById("quoteCategory").value = "";
    alert("Quote added successfully!");
  }
}

// =======================
// Populate Categories
// =======================
function populateCategories() {
  const uniqueCategories = [...new Set(quotes.map(q => q.category))];
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  uniqueCategories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    categoryFilter.appendChild(option);
  });
  // Restore last selected filter
  const lastFilter = localStorage.getItem("lastSelectedCategory");
  if (lastFilter) {
    categoryFilter.value = lastFilter;
  }
}

// =======================
// Filter Quotes
// =======================
function filterQuotes() {
  localStorage.setItem("lastSelectedCategory", categoryFilter.value);
  showQuote();
}

function getFilteredQuotes() {
  const selectedCategory = categoryFilter.value;
  if (selectedCategory === "all") {
    return quotes;
  }
  return quotes.filter(q => q.category === selectedCategory);
}

// =======================
// Import Quotes from JSON
// =======================
function importFromJsonFile(event) {
  const fileReader = new FileReader();
  fileReader.onload = function(e) {
    const importedQuotes = JSON.parse(e.target.result);
    quotes.push(...importedQuotes);
    saveQuotes();
    populateCategories();
    alert("Quotes imported successfully!");
  };
  fileReader.readAsText(event.target.files[0]);
}

// =======================
// Export Quotes to JSON
// =======================
function exportToJsonFile() {
  const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  a.click();
  URL.revokeObjectURL(url);
}

// =======================
// Server Sync Simulation
// =======================
async function fetchQuotesFromServer() {
  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts");
    const data = await response.json();
    // Simulate converting server data into quotes
    return data.slice(0, 5).map(item => ({
      text: item.title,
      category: "Server"
    }));
  } catch (error) {
    console.error("Error fetching from server:", error);
    return [];
  }
}

async function syncQuotes() {
  const serverQuotes = await fetchQuotesFromServer();
  let updated = false;

  serverQuotes.forEach(sq => {
    if (!quotes.some(lq => lq.text === sq.text)) {
      quotes.push(sq);
      updated = true;
    }
  });

  if (updated) {
    saveQuotes();
    populateCategories();
    showNotification("Quotes updated from server.");
  }
}

// =======================
// Notification UI
// =======================
function showNotification(message) {
  notification.textContent = message;
  notification.style.position = "fixed";
  notification.style.top = "10px";
  notification.style.right = "10px";
  notification.style.background = "yellow";
  notification.style.padding = "10px";
  notification.style.border = "1px solid black";
  setTimeout(() => { notification.textContent = ""; }, 3000);
}

// =======================
// Initialize
// =======================
document.getElementById("newQuoteBtn").addEventListener("click", showQuote);
createAddQuoteForm();
populateCategories();
showQuote();
setInterval(syncQuotes, 10000); // sync every 10 seconds
