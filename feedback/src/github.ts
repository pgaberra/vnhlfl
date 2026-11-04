import { toBase64 } from './files';

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    request: string,
    detail: string,
  ) {
    super(`GitHub ${request} failed with ${status}: ${detail.slice(0, 300)}`);
  }
}

const BRANCH_README = `# Feedback attachments

Files sent with bug reports and suggestions from the site's "Tyck till" form. Each folder belongs
to one issue, which links to it. Nothing here is built or deployed.
`;

/** The few GitHub REST calls the Worker needs, scoped to one repository. */
export class GitHub {
  constructor(
    private readonly token: string,
    private readonly repo: string,
  ) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`https://api.github.com/repos/${this.repo}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'vnhlfl-feedback',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new GitHubError(response.status, `${method} ${path}`, await response.text());
    }
    return (await response.json()) as T;
  }

  /** Creates the attachments branch as an orphan (no site code in it) the first time it's needed. */
  async ensureBranch(branch: string): Promise<void> {
    try {
      await this.call('GET', `/git/ref/heads/${branch}`);
      return;
    } catch (e) {
      if (!(e instanceof GitHubError && e.status === 404)) throw e;
    }
    const tree = await this.call<{ sha: string }>('POST', '/git/trees', {
      tree: [{ path: 'README.md', mode: '100644', type: 'blob', content: BRANCH_README }],
    });
    const commit = await this.call<{ sha: string }>('POST', '/git/commits', {
      message: 'chore: start the feedback attachments branch',
      tree: tree.sha,
      parents: [],
    });
    await this.call('POST', '/git/refs', { ref: `refs/heads/${branch}`, sha: commit.sha });
  }

  async putFile(branch: string, path: string, bytes: Uint8Array, message: string): Promise<void> {
    await this.call('PUT', `/contents/${path}`, { message, content: toBase64(bytes), branch });
  }

  createIssue(issue: { title: string; body: string; labels: string[] }) {
    return this.call<{ number: number; html_url: string }>('POST', '/issues', issue);
  }
}
