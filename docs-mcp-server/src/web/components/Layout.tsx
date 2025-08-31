import type { PropsWithChildren } from "@kitajs/html";
import { readFileSync } from "node:fs";
import { logger } from "../../utils/logger";

/**
 * Props for the Layout component.
 */
interface LayoutProps extends PropsWithChildren {
  title: string;
  /** Optional version string to display next to the title. */
  version?: string;
}

/**
 * Base HTML layout component for all pages.
 * Includes common head elements, header, and scripts.
 * @param props - Component props including title, version, and children.
 */
const Layout = ({ title, version, children }: LayoutProps) => {
  let versionString = version;
  if (!versionString) {
    // If no version is provided, use the version from package.json
    // We cannot bake the version into the bundle, as the package.json will
    // be updated by the build process, after the bundle is created.
    try {
      const packageJson = JSON.parse(readFileSync("package.json", "utf-8")) as {
        version: string;
      };
      versionString = packageJson.version;
    } catch (error) {
      logger.error(`Error reading package.json: ${error}`);
    }
  }
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title safe>{title}</title>
        {/* Bundled CSS (includes Tailwind and Flowbite) */}
        <link rel="stylesheet" href="/assets/main.css" />
        {/* Add style for htmx-indicator behavior (needed globally) */}
        <style>
          {`
          .htmx-indicator {
            display: none;
          }
          .htmx-request .htmx-indicator {
            display: block;
          }
          .htmx-request.htmx-indicator {
            display: block;
          }
          /* Default: Hide skeleton, show results container */
          #searchResultsContainer .search-skeleton { display: none; }
          #searchResultsContainer .search-results { display: block; } /* Or as needed */

          /* Request in progress: Show skeleton, hide results */
          #searchResultsContainer.htmx-request .search-skeleton { display: block; } /* Or flex etc. */
          #searchResultsContainer.htmx-request .search-results { display: none; }

          /* Keep button spinner logic */
          form .htmx-indicator .spinner { display: flex; }
          form .htmx-indicator .search-text { display: none; }
          form .spinner { display: none; }
        `}
        </style>
      </head>
      <body class="bg-gray-50 dark:bg-gray-900">
        <div class="container max-w-2xl mx-auto px-4 py-4">
          <header class="mb-4">
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
              <a href="/">MCP Docs</a>
              {versionString ? (
                <span
                  safe
                  class="ml-2 text-base font-normal text-gray-500 dark:text-gray-400 align-baseline"
                  title={`Version ${versionString}`}
                >
                  v{versionString}
                </span>
              ) : null}
            </h1>
          </header>

          <main>{children}</main>
        </div>

        {/* Bundled JS (includes Flowbite, HTMX, AlpineJS, and initialization) */}
        <script type="module" src="/assets/main.js"></script>
      </body>
    </html>
  );
};

export default Layout;
