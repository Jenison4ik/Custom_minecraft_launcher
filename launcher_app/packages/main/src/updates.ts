// import { app, dialog } from "electron";
// import { autoUpdater } from "electron-updater";

// /**
//  * Настройка URL для обновлений
//  * electron-updater умеет работать с "generic" провайдерами
//  */
// const UPDATE_URL = "https://jenison.ru"; // базовый адрес

// export function initAutoUpdater(): void {
//   // Устанавливаем feed (generic server)
//   autoUpdater.setFeedURL({
//     provider: "generic",
//     url: UPDATE_URL,
//   });

//   // Логируем ошибки
//   autoUpdater.on("error", (err) => {
//     console.error("Ошибка автообновления:", err);
//   });

//   // Проверка
//   autoUpdater.on("checking-for-update", () => {
//     console.log("Проверка обновлений...");
//   });

//   // Нашли обновление
//   autoUpdater.on("update-available", (info) => {
//     console.log("Доступно обновление:", info.version);
//   });

//   // Обновлений нет
//   autoUpdater.on("update-not-available", () => {
//     console.log("Обновлений нет.");
//   });

//   // Прогресс скачивания
//   autoUpdater.on("download-progress", (progress) => {
//     console.log(
//       `Скачивание: ${progress.percent.toFixed(2)}% (${progress.transferred}/${progress.total})`
//     );
//   });

//   // Когда обновление скачано
//   autoUpdater.on("update-downloaded", (info) => {
//     console.log("Обновление скачано:", info.version);

//     const result = dialog.showMessageBoxSync({
//       type: "question",
//       buttons: ["Перезапустить сейчас", "Позже"],
//       defaultId: 0,
//       cancelId: 1,
//       title: "Обновление доступно",
//       message: `Новая версия ${info.version} скачана. Установить сейчас?`,
//     });

//     if (result === 0) {
//       // Закрыть приложение и применить обновление
//       autoUpdater.quitAndInstall(false, true);
//     }
//   });
// }
