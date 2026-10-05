// ============================================
// Кастомные тултипы
// ============================================

let currentTooltip = null;

export function showTooltip(targetEl, contentEl) {
  hideTooltip();

  const tooltip = document.createElement('div');
  tooltip.className = 'custom-tooltip';
  tooltip.appendChild(contentEl);
  document.body.appendChild(tooltip);
  currentTooltip = tooltip;

  positionTooltip(tooltip, targetEl);
}

export function hideTooltip() {
  if (currentTooltip) {
    currentTooltip.remove();
    currentTooltip = null;
  }
}

function positionTooltip(tooltip, targetEl) {
  const rect = targetEl.getBoundingClientRect();
  const tipRect = tooltip.getBoundingClientRect();

  // По умолчанию — слева от элемента
  let left = rect.left - tipRect.width - 12;
  let top = rect.top;

  // Если не влезает слева — справа
  if (left < 8) {
    left = rect.right + 12;
  }

  // Если не влезает снизу — поднимаем
  if (top + tipRect.height > window.innerHeight - 8) {
    top = window.innerHeight - tipRect.height - 8;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}