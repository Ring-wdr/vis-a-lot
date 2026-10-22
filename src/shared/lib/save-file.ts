// 브라우저에서 파일 내려받기. 임시 링크를 눌러 저장하고 URL은 바로 돌려준다.

/** 파일 이름에 쓸 수 없는 글자를 _로 바꾼다. */
export function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 100) || "chart";
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  // 다운로드가 시작된 뒤에 URL을 놓는다.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
