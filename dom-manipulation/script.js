// -------------------- INITIAL DATA --------------------
let quotes = [
  { text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
  { text: "Your time is limited, so don’t waste it living someone else’s life.", category: "Inspiration" },
  { text: "Success is not final; failure is not fatal: It is the courage to continue that counts.", category: "Motivation" },
  { text: "Creativity is intelligence having fun.", category: "Creativity" }
];

// -------------------- STORAGE FUNCTIONS --------------------
function saveQuotes() {
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

function loadQuotes() {
  const stored = localStorage.getItem("quotes");
  if (stored) {
    quotes = JSON.parse(stored);
  }
}

function saveLastCategory(category) {
  localStorage.setItem("lastCategory", category);
}

function loadLastCategory() {
  return localStorage.getItem("lastCategory") || "all";
}

// -------------------- DOM ELEMENTS --------------------
const quoteDisplay = document.getElementById("quoteDisplay");
const categoryFilter = document.getElementById("categoryFilter");

// -------------------- CATEGORY FUNCTIONS --------------------
function populateCategories() {
  // Clear existing (except "All")
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;

  const categories = [...new Set(quotes.map(q => q.category))];
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    categoryFilter.appendChild(option);
  });

  // Restore last selected category from storage
  const lastCat = loadLastCategory();
  categoryFilter.value = lastCat;
}

// -------------------- FILTERING --------------------
function filterQuotes() {
  const selectedCategory = categoryFilter.value;
  saveLastCategory(selectedCategory);

  let filteredQuotes = quotes;
  if (selectedCategory !== "all") {
    filteredQuotes = quotes.filter(q => q.category === selectedCategory);
  }

  // Just show the first quote from filtered set
  if (filteredQuotes.length > 0) {
    const randomQuote = filteredQuotes[Math.floor(Math.random() * filteredQuotes.length)];
    quoteDisplay.textContent = `"${randomQuote.text}" — ${randomQuote.category}`;
  } else {
    quoteDisplay.textContent = "No quotes found for this category.";
  }
}

// -------------------- RANDOM QUOTE --------------------
function showRandomQuote() {
  filterQuotes();
}

// -------------------- ADD QUOTE --------------------
function addQuote() {
  const text = document.getElementById("newQuoteText").value.trim();
  const category = document.getElementById("newQuoteCategory").value.trim();

  if (!text || !category) {
    alert("Please enter both a quote and a category.");
    return;
  }

  quotes.push({ text, category });
  saveQuotes();
  populateCategories();

  document.getElementById("newQuoteText").value = "";
  document.getElementById("newQuoteCategory").value = "";

  alert("Quote added successfully!");
}

function createAddQuoteForm() {
  const formContainer = document.getElementById("formContainer");

  const textInput = document.createElement("input");
  textInput.id = "newQuoteText";
  textInput.type = "text";
  textInput.placeholder = "Enter a new quote";

  const categoryInput = document.createElement("input");
  categoryInput.id = "newQuoteCategory";
  categoryInput.type = "text";
  categoryInput.placeholder = "Enter quote category";

  const addButton = document.createElement("button");
  addButton.textContent = "Add Quote";
  addButton.addEventListener("click", addQuote);

  formContainer.appendChild(textInput);
  formContainer.appendChild(categoryInput);
  formContainer.appendChild(addButton);
}

// -------------------- INIT --------------------
loadQuotes();
populateCategories();
createAddQuoteForm();
document.getElementById("newQuote").addEventListener("click", showRandomQuote);
filterQuotes(); // Show something immediately
