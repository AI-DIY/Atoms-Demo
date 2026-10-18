export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.style.cssText = "position:fixed;left:-9999px;top:0";
  document.body.appendChild(field);
  field.select();
  try {
    if (!document.execCommand("copy"))
      throw new Error("复制失败，请手动选择链接复制");
  } finally {
    field.remove();
  }
}
