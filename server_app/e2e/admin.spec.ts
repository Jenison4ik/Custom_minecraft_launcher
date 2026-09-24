import { expect, test } from "@playwright/test";

test("login, upload a file, then delete it", async ({ page }) => {
  await page.goto("login");
  await page.getByLabel("Логин").fill("admin");
  await page.getByLabel("Пароль").fill("secret");
  await page.getByRole("button", { name: "Войти" }).click();

  await page.getByLabel("Файлы .jar").setInputFiles({
    name: "e2e.jar",
    mimeType: "application/java-archive",
    buffer: Buffer.from("e2e-file"),
  });
  await expect(page.getByLabel("Путь")).toHaveValue("mods/e2e.jar");
  await page.getByRole("button", { name: "Загрузить", exact: true }).click();

  const row = page.locator("p.text-xs", { hasText: "e2e.jar" });
  await expect(row).toBeVisible();
  await expect(page.getByText("mods/e2e.jar")).toHaveCount(0);

  await page.getByRole("button", { name: "Удалить" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();
  await expect(row).toHaveCount(0);
});
