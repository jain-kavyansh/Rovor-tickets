export class InvalidRepoError extends Error {}

const OWNER_RE = /^[a-z\d](?:[a-z\d-]{0,38})$/i;
const REPO_RE = /^[\w.-]{1,100}$/;

/**
 * Accepts "owner/repo", "https://github.com/owner/repo", with optional trailing
 * slash / ".git" / www. Returns normalized "owner/repo" or throws InvalidRepoError.
 */
export function normalizeRepo(input: string): string {
  let s = input.trim();
  if (!s) throw new InvalidRepoError("Repository is empty");

  if (/^https?:\/\//i.test(s) || /^(www\.)?github\.com\//i.test(s)) {
    const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    let url: URL;
    try {
      url = new URL(withProto);
    } catch {
      throw new InvalidRepoError("Invalid GitHub URL");
    }
    if (!["github.com", "www.github.com"].includes(url.hostname.toLowerCase())) {
      throw new InvalidRepoError("Only github.com repositories are supported");
    }
    s = url.pathname;
  }

  const parts = s.split("/").filter(Boolean);
  if (parts.length !== 2) throw new InvalidRepoError("Use the form owner/repo or https://github.com/owner/repo");
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!OWNER_RE.test(owner) || owner.endsWith("-")) throw new InvalidRepoError("Invalid repository owner");
  if (!REPO_RE.test(repo) || repo === "." || repo === "..") throw new InvalidRepoError("Invalid repository name");
  return `${owner}/${repo}`;
}
