let gameData = null;
let isSpinning = false;

let runState = {
  className: null,
  subclass: null,
  aspects: [],
  fragments: [],
  artifact: [],
  mods: [],
  exoticArmour: null,
  exoticWeapon: null,
  history: []
};

// DOM Elements
const btnNewRun = document.getElementById('btn-new-run');
const btnSpin = document.getElementById('btn-spin');
const btnExoticAny = document.getElementById('btn-exotic-any');
const btnExoticArmour = document.getElementById('btn-exotic-armour');
const btnExoticWeapon = document.getElementById('btn-exotic-weapon');

const spinDisplay = document.getElementById('spin-display');
const spinCategory = document.getElementById('spin-category');
const spinResult = document.getElementById('spin-result');

// Load JSON data on startup
fetch('./data/destiny_pool.json')
    .then(response => response.json())
    .then(data => {
      gameData = data;
    })
    .catch(err => {
      spinCategory.textContent = "ERROR";
      spinResult.textContent = "Failed to load data/destiny_pool.json";
      console.error(err);
    });

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function setButtonsDisabled(disabled) {
  btnNewRun.disabled = disabled;
  btnSpin.disabled = disabled || !runState.className;
  btnExoticAny.disabled = disabled || !runState.className;
  btnExoticArmour.disabled = disabled || !runState.className;
  btnExoticWeapon.disabled = disabled || !runState.className;
}

// Visual Spin Animation Helper
function animateSpin(categoryLabel, poolArray, finalResult, styleClass, onComplete) {
  isSpinning = true;
  setButtonsDisabled(true);

  spinDisplay.className = 'spinner-box spinning';
  spinCategory.textContent = categoryLabel;

  let ticks = 0;
  const maxTicks = 18;
  const interval = setInterval(() => {
    spinResult.textContent = getRandomItem(poolArray);
    ticks++;

    if (ticks >= maxTicks) {
      clearInterval(interval);
      spinResult.textContent = finalResult;
      spinDisplay.className = `spinner-box ${styleClass}`;
      isSpinning = false;
      setButtonsDisabled(false);
      onComplete();
    }
  }, 55);
}

function addHistory(badgeText, description, badgeType = '') {
  const stepNumber = runState.history.length + 1;
  runState.history.unshift({
    step: stepNumber,
    badge: badgeText,
    text: description,
    type: badgeType
  });
  renderHistory();
}

// 1. Start New Run
btnNewRun.addEventListener('click', () => {
  if (!gameData || isSpinning) return;

  const classes = Object.keys(gameData.classes);
  const chosenClass = getRandomItem(classes);
  const subclasses = Object.keys(gameData.classes[chosenClass].subclasses);
  const chosenSubclass = getRandomItem(subclasses);

  // Build preview pool for visual spin
  const previewPool = [];
  classes.forEach(c => {
    Object.keys(gameData.classes[c].subclasses).forEach(sub => {
      previewPool.push(`${c} — ${sub}`);
    });
  });

  const finalLabel = `${chosenClass} — ${chosenSubclass}`;
  const winStyle = chosenSubclass === 'Prismatic' ? 'prismatic-win' : '';

  animateSpin("ROLLING STARTING GUARDIAN...", previewPool, finalLabel, winStyle, () => {
    runState = {
      className: chosenClass,
      subclass: chosenSubclass,
      aspects: [],
      fragments: [],
      artifact: [],
      mods: [],
      exoticArmour: null,
      exoticWeapon: null,
      history: []
    };

    spinCategory.textContent = "STARTING RUN STATE";
    addHistory("Start", `Rolled ${chosenClass} (${chosenSubclass}) — Basic gear only`, "start");
    updateUI();
  });
});

// 2. Standard Two-Step Spin
btnSpin.addEventListener('click', () => {
  if (isSpinning) return;

  const subclassData = gameData.classes[runState.className].subclasses[runState.subclass];

  const availableAspects = subclassData.aspects.filter(a => !runState.aspects.includes(a));
  const availableFragments = subclassData.fragments.filter(f => !runState.fragments.includes(f));
  const availableArtifact = gameData.shared.artifactTiers.filter(t => !runState.artifact.includes(t));
  const availableMods = gameData.shared.armorModSlots.filter(m => !runState.mods.includes(m));

  const eligibleCategories = [];
  if (availableAspects.length > 0) eligibleCategories.push('Aspect');
  if (runState.aspects.length > 0 && availableFragments.length > 0) eligibleCategories.push('Fragment');
  if (availableArtifact.length > 0) eligibleCategories.push('Artifact');
  if (availableMods.length > 0) eligibleCategories.push('Armour Mod');

  if (eligibleCategories.length === 0) {
    spinCategory.textContent = "MAXED OUT";
    spinResult.textContent = "All standard build elements are already unlocked!";
    btnSpin.disabled = true;
    return;
  }

  // Step 1: Pick Category
  const chosenCategory = getRandomItem(eligibleCategories);
  let targetPool = [];
  let unlockedItem = "";

  // Step 2: Pick Item within Category
  if (chosenCategory === 'Aspect') {
    targetPool = availableAspects;
    unlockedItem = getRandomItem(targetPool);
  } else if (chosenCategory === 'Fragment') {
    targetPool = availableFragments;
    unlockedItem = getRandomItem(targetPool);
  } else if (chosenCategory === 'Artifact') {
    targetPool = availableArtifact;
    unlockedItem = getRandomItem(targetPool);
  } else if (chosenCategory === 'Armour Mod') {
    targetPool = availableMods;
    unlockedItem = getRandomItem(targetPool);
  }

  // Ensure visual spinner has multiple items to cycle through even if only 1 remains
  const visualPool = targetPool.length > 1 ? targetPool : [unlockedItem, "Decrypting Engram...", "Scanning Subclass..."];

  animateSpin(`CATEGORY: ${chosenCategory.toUpperCase()}`, visualPool, unlockedItem, '', () => {
    if (chosenCategory === 'Aspect') runState.aspects.push(unlockedItem);
    if (chosenCategory === 'Fragment') runState.fragments.push(unlockedItem);
    if (chosenCategory === 'Artifact') runState.artifact.push(unlockedItem);
    if (chosenCategory === 'Armour Mod') runState.mods.push(unlockedItem);

    addHistory(chosenCategory, `Unlocked ${unlockedItem}`);
    updateUI();
  });
});

// 3. Exotic Spin Handlers
function handleExoticSpin(mode) {
  if (isSpinning) return;

  let rollType = mode;
  if (mode === 'any') {
    rollType = Math.random() < 0.5 ? 'armour' : 'weapon';
  }

  if (rollType === 'armour') {
    let classExotics = [...gameData.classes[runState.className].exoticArmor];

    // Only include Prismatic Exotic Class Item if playing Prismatic
    if (runState.subclass === 'Prismatic') {
      classExotics.push(gameData.classes[runState.className].prismaticClassItem);
    }

    const pool = classExotics.filter(item => item !== runState.exoticArmour);
    const chosen = getRandomItem(pool);

    animateSpin(`EXOTIC ${runState.className.toUpperCase()} ARMOUR`, pool, chosen, 'exotic-win', () => {
      runState.exoticArmour = chosen;
      addHistory("Exotic Armour", `Equipped ${chosen}`, "exotic");
      updateUI();
    });

  } else {
    const weaponExotics = gameData.shared.exoticWeapons;
    const pool = weaponExotics.filter(item => item !== runState.exoticWeapon);
    const chosen = getRandomItem(pool);

    animateSpin("EXOTIC WEAPON", pool, chosen, 'exotic-win', () => {
      runState.exoticWeapon = chosen;
      addHistory("Exotic Weapon", `Equipped ${chosen}`, "exotic");
      updateUI();
    });
  }
}

btnExoticAny.addEventListener('click', () => handleExoticSpin('any'));
btnExoticArmour.addEventListener('click', () => handleExoticSpin('armour'));
btnExoticWeapon.addEventListener('click', () => handleExoticSpin('weapon'));

// Update the HTML display
function updateUI() {
  document.getElementById('state-class').textContent = runState.className;

  const subEl = document.getElementById('state-subclass');
  subEl.textContent = runState.subclass;
  subEl.className = runState.subclass === 'Prismatic' ? 'prismatic-text' : '';

  document.getElementById('state-exotic-armour').textContent = runState.exoticArmour || 'None';
  document.getElementById('state-exotic-weapon').textContent = runState.exoticWeapon || 'None';

  renderList('list-aspects', runState.aspects, 'None unlocked');

  const fragEmptyText = runState.aspects.length === 0
      ? 'Locked (Requires 1 Aspect)'
      : 'None unlocked';
  renderList('list-fragments', runState.fragments, fragEmptyText);

  renderList('list-artifact', runState.artifact, 'None unlocked');
  renderList('list-mods', runState.mods, 'None unlocked');
}

function renderList(elementId, items, emptyMessage) {
  const ul = document.getElementById(elementId);
  ul.innerHTML = '';
  if (items.length === 0) {
    const li = document.createElement('li');
    li.textContent = emptyMessage;
    li.style.color = '#8b949e';
    ul.appendChild(li);
    return;
  }
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    ul.appendChild(li);
  });
}

function renderHistory() {
  const ul = document.getElementById('history-list');
  ul.innerHTML = '';
  if (runState.history.length === 0) {
    ul.innerHTML = '<li class="muted">No actions recorded yet.</li>';
    return;
  }

  runState.history.forEach(entry => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span><strong>#${entry.step}</strong> &nbsp;${entry.text}</span>
      <span class="badge ${entry.type}">${entry.badge}</span>
    `;
    ul.appendChild(li);
  });
}
