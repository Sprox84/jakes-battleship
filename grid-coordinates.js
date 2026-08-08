(function () {
  'use strict';

  const letters = 'ABCDEFGHIJ';
  const mountedStages = [];
  let resizeTimer;
  const stageObserver = 'ResizeObserver' in window ? new ResizeObserver(entries => {
    entries.forEach(entry => {
      if (entry.contentRect.width > 0) requestAnimationFrame(() => refresh(entry.target));
    });
  }) : null;
  const visibilityObserver = 'MutationObserver' in window ? new MutationObserver(() => {
    requestAnimationFrame(() => mountedStages.forEach(stage => {
      if (stage.getBoundingClientRect().width > 0) refresh(stage);
    }));
  }) : null;

  function boardName(board) {
    if (board.id === 'enemyBoard') return 'Enemy ocean';
    if (board.id === 'playerBoard') return 'Your fleet';
    return 'Your ocean';
  }

  function refresh(stage) {
    const board = stage.querySelector('.board');
    const layer = stage.querySelector('.coordinateLayer');
    if (!board || !layer || board.children.length < 100) return;

    const stageRect = stage.getBoundingClientRect();
    const firstCellRect = board.children[0].getBoundingClientRect();
    const columnLabels = layer.querySelectorAll('.coordinateLabel.column');
    const rowLabels = layer.querySelectorAll('.coordinateLabel.row');
    const topCenter = (firstCellRect.top - stageRect.top) / 2;
    const leftCenter = (firstCellRect.left - stageRect.left) / 2;

    columnLabels.forEach((label, column) => {
      const rect = board.children[column].getBoundingClientRect();
      label.style.left = `${rect.left - stageRect.left + rect.width / 2}px`;
      label.style.top = `${topCenter}px`;
    });

    rowLabels.forEach((label, row) => {
      const rect = board.children[row * 10].getBoundingClientRect();
      label.style.left = `${leftCenter}px`;
      label.style.top = `${rect.top - stageRect.top + rect.height / 2}px`;
    });
  }

  function mount(stage) {
    const board = stage.querySelector('.board');
    if (!board || stage.querySelector('.coordinateLayer')) return;

    const layer = document.createElement('div');
    layer.className = 'coordinateLayer';
    layer.setAttribute('aria-hidden', 'true');
    const corner = document.createElement('span');
    corner.className = 'coordinateCorner';
    corner.textContent = '⌖';
    layer.appendChild(corner);

    [...letters].forEach(letter => {
      const label = document.createElement('span');
      label.className = 'coordinateLabel column';
      label.textContent = letter;
      layer.appendChild(label);
    });

    Array.from({ length: 10 }, (_, row) => row + 1).forEach(row => {
      const label = document.createElement('span');
      label.className = 'coordinateLabel row';
      label.textContent = String(row);
      layer.appendChild(label);
    });
    stage.appendChild(layer);

    const name = boardName(board);
    Array.from(board.children).forEach((cell, index) => {
      const row = Math.floor(index / 10);
      const column = index % 10;
      const coordinate = letters[column] + (row + 1);
      cell.setAttribute('aria-label', `${name} ${coordinate}`);
      cell.title = coordinate;
    });

    mountedStages.push(stage);
    stageObserver?.observe(stage);
    requestAnimationFrame(() => refresh(stage));
  }

  addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.stage').forEach(mount);
    document.querySelectorAll('#setup, #battle').forEach(section => {
      visibilityObserver?.observe(section, { attributes: true, attributeFilter: ['class'] });
    });
  });

  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => mountedStages.forEach(refresh), 120);
  });

  addEventListener('orientationchange', () => {
    setTimeout(() => mountedStages.forEach(refresh), 260);
  });

  window.GridCoordinates = {
    refreshAll() {
      mountedStages.forEach(stage => {
        if (stage.getBoundingClientRect().width > 0) refresh(stage);
      });
    }
  };
})();
