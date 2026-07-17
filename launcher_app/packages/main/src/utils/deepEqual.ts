type FileEntry = {
  sha1: string;
  size: number;
};

type FilesObject = {
  files: Record<string, FileEntry>;
};

export default async function deepEqual(
  local: FilesObject,
  server: FilesObject
): Promise<boolean> {
  const localFiles = local.files;
  const serverFiles = server.files;

  for (const key of Object.keys(serverFiles)) {
    if (!(key in localFiles)) {
      console.log(`❌ The local manifest does not contain the file: ${key}`);
      return false; // не хватает файла из серверного манифеста
    }

    const fLocal = localFiles[key];
    const fServer = serverFiles[key];

    if (fLocal.sha1 !== fServer.sha1 || fLocal.size !== fServer.size) {
      console.log(`❌ The file is different: ${key}`);
      return false; // файл отличается
    }
  }

  // Если дошли сюда, значит все файлы сервера есть и совпадают → true
  return true;
}
