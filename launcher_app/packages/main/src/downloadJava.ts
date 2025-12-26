// import * as path from "path";
// import { app } from "electron";
// import sendError from "./sendError";
// import sendDownloadStatus from "./sendDownloadStatus";
// import { installJavaRuntimeTask, resolveJava } from "@xmcl/installer";
// import { JavaVersion } from "@xmcl/core";

// const javaBaseDir = path.join(app.getPath("userData"), "java");
// const java25Path = path.join(javaBaseDir, "temurin-25");
// const os =
//   process.platform === "win32"
//     ? "windows"
//     : process.platform === "darwin"
//       ? "mac"
//       : "linux";
// const arch = process.arch === "x64" ? "x64" : "aarch64";

// // URL для Temurin 25 (требуется для версии Minecraft с java-runtime-epsilon)
// // Используем latest для получения последней доступной версии Java 25
// // Если Java 25 недоступна, попробуем Java 23 (также поддерживает --sun-misc-unsafe-memory-access=allow)
// const JAVA_URL_25 = `https://api.adoptium.net/v3/binary/latest/25/ga/${os}/${arch}/jdk/hotspot/normal/eclipse?project=jdk`;
// const JAVA_URL_23 = `https://api.adoptium.net/v3/binary/latest/23/ga/${os}/${arch}/jdk/hotspot/normal/eclipse?project=jdk`;

// export async function ensureJava(JavaVersion: JavaVersion): Promise<string> {
//   const JavaVersionNumber = JavaVersion.majorVersion;
//   const currentJavaPath = path.join(app.getPath("userData"), "java", `java${JavaVersionNumber}`);

//   installJavaRuntimeTask({
//     destination: currentJavaPath,
//   })

// }
