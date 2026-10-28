import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest does not expose globals by default, so React Testing Library's
// automatic cleanup is not registered. Unmount between tests ourselves.
afterEach(() => {
  cleanup();
});
