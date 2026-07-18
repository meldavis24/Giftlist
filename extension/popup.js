const setupNotice = document.getElementById("setupNotice");
const addForm = document.getElementById("addForm");
const listSelect = document.getElementById("list");
const titleInput = document.getElementById("title");
const urlInput = document.getElementById("url");
const statusEl = document.getElementById("status");
const submitButton = document.getElementById("submit");

document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#15803d";
}

async function init() {
  const { baseUrl, token } = await chrome.storage.sync.get(["baseUrl", "token"]);
  if (!baseUrl || !token) {
    setupNotice.classList.remove("hidden");
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  urlInput.value = tab?.url ?? "";
  titleInput.value = tab?.title ?? "";

  try {
    const res = await fetch(`${baseUrl}/api/extension/lists`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Couldn't load lists (${res.status})`);
    const { lists } = await res.json();

    if (!lists.length) {
      setStatus("You don't have any lists yet -- create one in the app first.", true);
      return;
    }

    listSelect.innerHTML = lists
      .map((l) => `<option value="${l.id}">${l.name}${l.occasion ? ` (${l.occasion})` : ""}</option>`)
      .join("");
    addForm.classList.remove("hidden");
  } catch (err) {
    setStatus(err.message || "Couldn't reach GiftList.", true);
  }
}

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitButton.disabled = true;
  setStatus("Adding...");

  const { baseUrl, token } = await chrome.storage.sync.get(["baseUrl", "token"]);

  try {
    const res = await fetch(`${baseUrl}/api/extension/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        list_id: listSelect.value,
        product_url: urlInput.value,
        title: titleInput.value,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Failed (${res.status})`);
    }

    setStatus("Added!");
  } catch (err) {
    setStatus(err.message || "Something went wrong.", true);
  } finally {
    submitButton.disabled = false;
  }
});

init();
