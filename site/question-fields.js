// Shared question controls for publishing, reviewing and editing.
import { $, $$, esc, icon } from './ui.js';
import { CATEGORIES, MAX_DOMAINS, domainGroups } from './categories.js';

export function categoryField(value = '') {
  return `<fieldset class="field"><legend class="field-label">题目类型<i>*</i></legend><div class="category-options">
    ${CATEGORIES.map((c) => `<label class="category-option"><input type="radio" name="category" value="${esc(c.name)}" required${c.name === value ? ' checked' : ''}>${icon(c.glyph)}<span><b>${esc(c.label)}</b><small>${esc(c.note)}</small></span></label>`).join('')}
    </div><p class="fine">类型决定排行榜分组与作品的提交格式。</p></fieldset>`;
}

export function domainField(platform, selected = []) {
  return `<fieldset class="field domain-field"><legend class="field-label">所属领域<i>*</i><small data-domain-count aria-live="polite">已选 ${selected.length} / ${MAX_DOMAINS}</small></legend>
    <div class="domain-groups">${domainGroups(platform).map((group) => `<div class="domain-group" role="group" aria-label="${esc(group.title)}"><span class="domain-group-title">${esc(group.title)}</span><div class="domain-options">
      ${group.domains.map((name) => `<label class="domain-option"><input type="checkbox" name="domains" value="${esc(name)}"${selected.includes(name) ? ' checked' : ''}><span>${esc(name)}</span></label>`).join('')}
    </div></div>`).join('')}</div><p class="fine">选 1–${MAX_DOMAINS} 个，方便按领域查找题目；选满后取消一项即可更换。</p></fieldset>`;
}

export function syncDomains(form) {
  const count = $$('[name="domains"]:checked', form).length;
  $$('[name="domains"]', form).forEach((box) => { box.disabled = count >= MAX_DOMAINS && !box.checked; });
  const status = $('[data-domain-count]', form);
  if (status) status.textContent = `已选 ${count} / ${MAX_DOMAINS}`;
}
