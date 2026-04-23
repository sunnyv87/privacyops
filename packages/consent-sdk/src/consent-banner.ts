import { ConsentClient } from './consent-client';
import type { ConsentNotice, ConsentSdkConfig } from './types';

/**
 * ConsentBanner — zero-dependency vanilla DOM banner. Fetches a notice,
 * renders purpose toggles, and posts a consent record back to the
 * existing PrivacyOps consent API.
 *
 * Design notes:
 *   - No React / framework dependency; safe to drop into any site.
 *   - ARIA-compliant dialog role for accessibility.
 *   - Required purposes are non-toggleable (disabled + checked).
 *   - Shadow DOM isolates styles from the host page.
 */
export class ConsentBanner {
  private readonly client: ConsentClient;
  private shadowRoot: ShadowRoot | null = null;
  private host: HTMLElement | null = null;

  constructor(private readonly config: ConsentSdkConfig) {
    this.client = new ConsentClient(config);
  }

  /** Mount the banner into `document.body` (or a provided element). */
  async mount(container: HTMLElement = document.body): Promise<void> {
    try {
      const notice = await this.client.getNotice();
      this.render(container, notice);
    } catch (err) {
      this.config.onError?.(err as Error);
    }
  }

  /** Programmatically remove the banner from the DOM. */
  unmount(): void {
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
      this.host = null;
      this.shadowRoot = null;
    }
  }

  private render(container: HTMLElement, notice: ConsentNotice): void {
    this.host = document.createElement('div');
    this.host.setAttribute('data-privacyops-consent', '');
    this.shadowRoot = this.host.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = this.buildHtml(notice);
    container.appendChild(this.host);

    const form = this.shadowRoot.querySelector('form');
    form?.addEventListener('submit', (e) => this.handleSubmit(e, notice));

    const rejectBtn = this.shadowRoot.querySelector('[data-action="reject"]') as HTMLButtonElement | null;
    rejectBtn?.addEventListener('click', () => this.handleRejectAll(notice));
  }

  private buildHtml(notice: ConsentNotice): string {
    const cls = this.escape(this.config.className ?? 'privacyops-consent');
    const purposes = (notice.purposes ?? [])
      .map((p) => {
        const disabled = p.required ? 'disabled checked' : (p.defaultEnabled ? 'checked' : '');
        return `
          <label class="purpose">
            <input type="checkbox" name="purpose" value="${this.escape(p.code)}" ${disabled} />
            <span class="purpose-name">${this.escape(p.name)}${p.required ? ' <em>(required)</em>' : ''}</span>
            ${p.description ? `<span class="purpose-desc">${this.escape(p.description)}</span>` : ''}
          </label>`;
      })
      .join('');

    return `
      <style>
        :host { all: initial; }
        .${cls} {
          position: fixed; bottom: 16px; left: 16px; right: 16px;
          max-width: 520px; margin: 0 auto;
          font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #111;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          z-index: 2147483646;
        }
        .title { font-size: 16px; font-weight: 600; margin: 0 0 8px; }
        .body { margin: 0 0 12px; color: #444; }
        .purpose { display: block; margin: 6px 0; }
        .purpose-name { font-weight: 500; margin-left: 6px; }
        .purpose-desc { display: block; color: #666; font-size: 12px; margin-left: 24px; }
        .actions { margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end; }
        button { font: inherit; padding: 8px 14px; border-radius: 6px; cursor: pointer; border: 1px solid #ccc; background: #fff; }
        button.primary { background: #111; color: #fff; border-color: #111; }
      </style>
      <div class="${cls}" role="dialog" aria-label="${this.escape(notice.title)}">
        <h2 class="title">${this.escape(notice.title)}</h2>
        <p class="body">${this.escape(notice.body)}</p>
        <form>
          ${purposes}
          <div class="actions">
            <button type="button" data-action="reject">Reject non-essential</button>
            <button type="submit" class="primary">Save preferences</button>
          </div>
        </form>
      </div>
    `;
  }

  private async handleSubmit(e: Event, notice: ConsentNotice): Promise<void> {
    e.preventDefault();
    if (!this.shadowRoot) return;
    const checkboxes = Array.from(
      this.shadowRoot.querySelectorAll<HTMLInputElement>('input[name="purpose"]:checked'),
    );
    const purposeCodes = checkboxes.map((c) => c.value);
    await this.submit(notice, purposeCodes);
  }

  private async handleRejectAll(notice: ConsentNotice): Promise<void> {
    const requiredCodes = (notice.purposes ?? []).filter((p) => p.required).map((p) => p.code);
    await this.submit(notice, requiredCodes);
  }

  private async submit(notice: ConsentNotice, purposeCodes: string[]): Promise<void> {
    try {
      const record = await this.client.grant({
        noticeId: notice.id,
        purposeCodes,
        channel: 'web',
        locale: this.config.language ?? (typeof navigator !== 'undefined' ? navigator.language : undefined),
      });
      this.config.onSubmit?.(record);
      this.unmount();
    } catch (err) {
      this.config.onError?.(err as Error);
    }
  }

  private escape(s: string | undefined): string {
    if (!s) return '';
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
