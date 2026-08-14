// Best-effort LaTeX → plain text for feeding a resume into the fit scorer.
// Not a full parser — just enough to produce readable text from a resume .tex.

export function stripLatex(tex: string): string {
  let s = tex;
  // Drop comments (a % not preceded by a backslash, to end of line).
  s = s.replace(/(^|[^\\])%.*$/gm, "$1");
  // Structural spacing macros.
  s = s.replace(/\\\\/g, "\n").replace(/\\item\b/g, "\n- ").replace(/~/g, " ");
  // \href{url}{text} -> text.
  s = s.replace(/\\href\{[^}]*\}\{([^}]*)\}/g, "$1");
  // Common text-formatting / sectioning macros -> their inner text.
  s = s.replace(
    /\\(?:textbf|textit|emph|underline|section\*?|subsection\*?|subsubsection\*?|textsc|textrm|texttt|large|small|mbox|text)\{([^{}]*)\}/g,
    "$1",
  );
  // Environments.
  s = s.replace(/\\(?:begin|end)\{[^}]*\}/g, "");
  // Any remaining command with a single braced arg -> keep the inner text.
  s = s.replace(/\\[a-zA-Z]+\*?\{([^{}]*)\}/g, "$1");
  // Remaining bare commands (with optional [..] args) -> drop.
  s = s.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, "");
  // Unescape escaped specials.
  s = s.replace(/\\([&%$#_{}])/g, "$1");
  // Leftover braces.
  s = s.replace(/[{}]/g, "");
  // Collapse whitespace.
  s = s
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}
