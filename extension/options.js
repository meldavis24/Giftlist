const baseUrlInput = document.getElementById("baseUrl");
const tokenInput = document.getElementById("token");
const savedEl = document.getElementById("saved");

async function load() {
  const { baseUrl, token } = await chrome.storage.sync.get(["baseUrl", "token"]);
  if (baseUrl) baseUrlInput.value = baseUrl;
  if (token) tokenInput.value = token;
}

document.getElementById("save").addEventListener("click", async () => {
  const baseUrl = baseUrlInput.value.trim().replace(/\/$/, "");
  const token = tokenInput.value.trim();
  await chrome.storage.sync.set({ baseUrl, token });
  savedEl.textContent = "Saved.";
  setTimeout(() => (savedEl.textContent = ""), 2000);
});

load();
