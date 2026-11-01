/** Copy text, falling back to a hidden textarea where the async clipboard is missing or blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** Drop the ``` fence lines an AI chat wraps around a script, keeping everything inside them. */
export function stripCodeFences(text: string): string {
  return text.replace(/^[ \t]*```[^\n]*(\n|$)/gm, '');
}
