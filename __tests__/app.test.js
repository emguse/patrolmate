const htmlTemplate = () => `
  <form id="patrol-form">
    <input name="operator" />
    <input id="patrol-date" name="patrol-date" type="date" />
    <select id="patrol-attribute"></select>
    <button type="submit">開始</button>
  </form>
  <section id="patrol-section" hidden>
    <div id="patrol-meta"></div>
    <ul id="patrol-list"></ul>
  </section>
  <button id="reset-session" type="button"></button>
  <button id="sync-button" type="button"></button>
  <div id="sync-status"></div>
  <dialog id="capture-dialog">
    <form method="dialog">
      <input id="capture-input" />
    </form>
  </dialog>
  <template id="patrol-item-template">
    <li class="patrol-item">
      <div class="item-main">
        <h3 class="item-title"></h3>
        <p class="item-description"></p>
      </div>
      <p class="item-code"></p>
      <input type="checkbox" />
      <button class="capture" type="button"></button>
    </li>
  </template>
`;

describe('patrolmate UI helpers', () => {
  beforeEach(() => {
    jest.resetModules();
    window.localStorage.clear();
    document.body.innerHTML = htmlTemplate();
  });

  test('populateAttributes adds placeholder and options', () => {
    const { populateAttributes } = require('../assets/app.js');

    populateAttributes({
      attributes: [
        { id: 'line-a', label: 'ラインA' },
        { id: 'line-b', label: 'ラインB' }
      ]
    });

    const select = document.querySelector('#patrol-attribute');
    const options = Array.from(select.options).map((option) => ({
      value: option.value,
      text: option.textContent
    }));

    expect(options).toEqual([
      { value: '', text: '選択してください' },
      { value: 'line-a', text: 'ラインA' },
      { value: 'line-b', text: 'ラインB' }
    ]);

    const loadButton = document.querySelector('#patrol-form button[type="submit"]');
    expect(select.disabled).toBe(false);
    expect(loadButton.disabled).toBe(false);
  });

  test('setCaptureInfo creates and removes info nodes', () => {
    const { setCaptureInfo } = require('../assets/app.js');
    const item = document.createElement('li');
    item.className = 'patrol-item';
    const main = document.createElement('div');
    main.className = 'item-main';
    item.appendChild(main);

    setCaptureInfo(item, 'ABC-123');
    let info = item.querySelector('.capture-info');
    expect(info).not.toBeNull();
    expect(info.textContent).toContain('ABC-123');

    setCaptureInfo(item, 'XYZ-789');
    info = item.querySelector('.capture-info');
    expect(info).not.toBeNull();
    expect(info.textContent).toContain('XYZ-789');

    setCaptureInfo(item, '');
    info = item.querySelector('.capture-info');
    expect(info).toBeNull();
  });

  test('formatTimestamp handles valid and invalid inputs', () => {
    const { formatTimestamp } = require('../assets/app.js');

    const formatted = formatTimestamp('2024-05-20T06:00:00Z');
    expect(formatted).toContain('2024');

    expect(formatTimestamp('not-a-date')).toBe('not-a-date');
    expect(formatTimestamp('')).toBe('');
  });
});
