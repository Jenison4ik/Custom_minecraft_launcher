import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

function installerZip(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "launcher-zip-"));
  const note = path.join(dir, "note.txt");
  const zipPath = path.join(dir, "installer.zip");
  fs.writeFileSync(note, "ok");
  const result = spawnSync(
    "python3",
    [
      "-c",
      "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w'); z.write(sys.argv[2],'note.txt'); z.close()",
      zipPath,
      note,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr || "zip failed");
  return zipPath;
}

test("publish launcher through the stepper", async ({ page }) => {
  await page.goto("login");
  await page.getByLabel("Логин").fill("admin");
  await page.getByLabel("Пароль").fill("secret");
  await page.getByRole("button", { name: "Войти" }).click();

  await page.getByRole("link", { name: "Сборки", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Сборки" })).toBeVisible();
  await expect(page.getByText("Опубликованных сборок нет")).toBeVisible();

  await page.getByRole("link", { name: "Лаунчер" }).click();
  await expect(page.getByRole("heading", { name: "Лаунчер" })).toBeVisible();

  const next = page.getByRole("button", { name: "Далее" });
  await expect(next).toBeDisabled();
  await page.getByRole("textbox", { name: "Версия" }).fill("1.2.3");
  await next.click();

  await page.locator("#launcher-zip").setInputFiles(installerZip());
  await expect(next).toBeEnabled();
  await next.click();

  const yml = page.getByRole("textbox", { name: "latest.yml" });
  await expect(yml).toBeVisible();
  await expect(next).toBeDisabled();
  await yml.fill("version: 1.2.3\n");
  await next.click();

  await expect(page.getByText("Проверка")).toBeVisible();
  await expect(page.getByText("1.2.3")).toBeVisible();
  await expect(page.getByText("installer.zip")).toBeVisible();
  await expect(page.getByText("Задан")).toBeVisible();

  await page.getByRole("button", { name: "Назад" }).click();
  await expect(page.getByRole("textbox", { name: "latest.yml" })).toHaveValue("version: 1.2.3\n");
  await page.getByRole("button", { name: "Далее" }).click();

  await page.getByRole("button", { name: "Опубликовать" }).click();
  await expect(page.getByText("Лаунчер обновлён")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Версия" })).toHaveValue("1.2.3");

  await page.getByRole("link", { name: "Сборки", exact: true }).click();
  await expect(page.getByText("Текущая сборка")).toBeVisible();
  await expect(page.locator("[data-slot=badge]")).toHaveText("1.2.3");
  await expect(page.getByText("note.txt")).toBeVisible();
  await expect(page.getByText("version: 1.2.3")).toBeVisible();
});
