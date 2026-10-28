import { expect, test } from "@playwright/test";

test.describe("Station Monitor", () => {
  test("loads the dashboard with live instrument rows and a status banner", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Station Monitor" })).toBeVisible();
    await expect(page.getByTestId("instrument-row").first()).toBeVisible();
    expect(await page.getByTestId("instrument-row").count()).toBeGreaterThan(5);
    await expect(page.getByTestId("alarm-banner")).toBeVisible();
  });

  test("filters the table by search text", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("instrument-row").first()).toBeVisible();
    const before = await page.getByTestId("instrument-row").count();

    await page.getByLabel("Search").fill("network");
    await expect.poll(async () => page.getByTestId("instrument-row").count()).toBeLessThan(before);
    for (const text of await page.getByTestId("instrument-row").allInnerTexts()) {
      expect(text).toContain("Network");
    }

    await page.getByLabel("Search").fill("zzzz-no-match");
    await expect(page.getByText("No instruments match the current filters.")).toBeVisible();
  });

  test("shows a trend chart when an instrument is selected", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Receiver LNA Temperature" }).click();
    await expect(page.getByTestId("trend-chart")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Receiver LNA Temperature" })).toBeVisible();
  });

  test("keeps updating without a page reload", async ({ page }) => {
    await page.goto("/");
    const stamp = page.locator(".meta");
    await expect(stamp).toContainText("updated");
    const first = await stamp.innerText();
    await expect.poll(async () => stamp.innerText(), { timeout: 10_000 }).not.toBe(first);
  });

  test("GraphQL endpoint answers queries and rejects bad requests", async ({ request }) => {
    const ok = await request.post("/api/graphql", {
      data: { query: "{ instruments { id name status } }" },
    });
    expect(ok.status()).toBe(200);
    const body = await ok.json();
    expect(body.data.instruments.length).toBeGreaterThan(5);

    const missing = await request.post("/api/graphql", { data: {} });
    expect(missing.status()).toBe(400);

    const invalid = await request.post("/api/graphql", { data: { query: "{ nope }" } });
    expect((await invalid.json()).errors.length).toBeGreaterThan(0);
  });
});
