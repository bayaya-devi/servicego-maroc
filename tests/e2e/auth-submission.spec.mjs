import { expect, test } from "@playwright/test";

test("the signup form sends one corrected submission after an invalid attempt", async ({ page, baseURL }) => {
  let submissions = 0;
  await page.route("**/api/config", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ turnstile: { enabled: false } }),
  }));
  await page.route("**/api/auth/register", async (route) => {
    submissions += 1;
    await new Promise((resolve) => setTimeout(resolve, 150));
    return route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "Indiquez une adresse e-mail valide." }),
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('.public-nucleus [data-action="open-auth"]').click();
  const form = page.locator('form[data-form="auth"]');
  await expect(form).toBeVisible();

  await form.locator('input[name="first_name"]').fill("QA");
  await form.locator('input[name="last_name"]').fill("Mobile");
  await form.locator('input[name="email"]').fill("qa@example.test");
  await form.locator('input[name="phone_number"]').fill("612345678");
  await form.locator('input[name="password"]').fill("A-test-password-2026");
  await form.locator('input[name="accept_terms"]').check();

  const submit = form.locator('[type="submit"]');
  await submit.dblclick();
  await expect(submit).toBeDisabled();
  await expect(page.locator(".notice")).toContainText("valid email address");
  expect(submissions).toBe(1);
});
