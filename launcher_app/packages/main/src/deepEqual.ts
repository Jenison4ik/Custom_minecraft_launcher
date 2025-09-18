type FileEntry = {
  sha1: string;
  size: number;
};

type FilesObject = {
  files: Record<string, FileEntry>;
};

export default async function deepEqual(
  obj1: FilesObject,
  obj2: FilesObject
): Promise<boolean> {
  const files1 = obj1.files;
  const files2 = obj2.files;

  // Сначала проверим, одинаковый ли набор ключей
  const keys1 = Object.keys(files1);
  const keys2 = Object.keys(files2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (!(key in files2)) {
      console.log(`\n\n\n ${key} is not exist\n\n\n`);
      return false;
    } else {
      console.log(`\n${key} finded!`);
    }

    const f1 = files1[key];
    const f2 = files2[key];

    // Сравнение именно по sha1 и size
    if (f1.sha1 !== f2.sha1 || f1.size !== f2.size) {
      console.log(`\n\n\n ${key} is not equal\n\n\n`);
      return false;
    }
  }

  return true;
}
