// Import the main CSS file which includes Tailwind and Flowbite styles
import "./styles/main.css";

import Alpine from "alpinejs";
import { initFlowbite } from "flowbite";
import htmx from "htmx.org";

// Ensure Alpine global store for confirmation actions is initialized before Alpine components render
Alpine.store("confirmingAction", {
  type: null,
  id: null,
  timeoutId: null,
  isDeleting: false,
});

Alpine.start();

// Initialize Flowbite components
initFlowbite();

// Add a global event listener for 'job-list-refresh' that uses HTMX to reload the job list
// This is still useful for manual refresh after actions like clearing jobs
document.addEventListener("job-list-refresh", () => {
  htmx.ajax("get", "/web/jobs", "#job-queue");
});

// Auto-refresh job list every 3 seconds for real-time progress updates
function autoRefreshJobList() {
  htmx.ajax("get", "/web/jobs", "#job-queue");
}

// Global variable to track the current interval
let autoRefreshInterval = setInterval(autoRefreshJobList, 3000);

// Stop auto-refresh when page is hidden to save resources
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearInterval(autoRefreshInterval);
  } else {
    // Restart auto-refresh when page becomes visible again
    autoRefreshInterval = setInterval(autoRefreshJobList, 3000);
  }
});

// Add a global event listener for 'version-list-refresh' that reloads the version list container using HTMX
document.addEventListener("version-list-refresh", (event: Event) => {
  const customEvent = event as CustomEvent<{ library: string }>;
  const library = customEvent.detail?.library;
  if (library) {
    htmx.ajax(
      "get",
      `/web/libraries/${encodeURIComponent(library)}/versions`,
      "#version-list",
    );
  }
});

// Listen for htmx swaps after a version delete and dispatch version-list-refresh with payload
document.body.addEventListener("htmx:afterSwap", (event) => {
  // Always re-initialize AlpineJS for swapped-in DOM to fix $store errors
  if (event.target instanceof HTMLElement) {
    Alpine.initTree(event.target);
  }

  // Existing logic for version delete refresh
  const detail = (event as CustomEvent).detail;
  if (
    detail?.xhr?.status === 204 &&
    detail?.requestConfig?.verb === "delete" &&
    (event.target as HTMLElement)?.id?.startsWith("row-")
  ) {
    // Extract library name from the row id: row-<library>-<version>
    const rowId = (event.target as HTMLElement).id;
    const match = rowId.match(/^row-([^-]+)-/);
    const library = match ? match[1] : null;
    if (library) {
      document.dispatchEvent(
        new CustomEvent("version-list-refresh", { detail: { library } }),
      );
    } else {
      window.location.reload();
    }
  }
});
