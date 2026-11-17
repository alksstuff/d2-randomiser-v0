let gameData = null;

let runState = {
  className: null,
  subclass: null,
  aspects: [],
  fragments: [],
  artifact: [],
  mods: [],
  exoticArmour: null,
  exoticWeapon: null
};

// DOM Elements
const btnNewRun = document.getElementById('btn-new-run');
const btnSpin = document.getElementById('btn-spin');
const btnExotic = document.getElementById('btn-exotic');
const spinResult = document.getElementById('spin-result');

// Load JSON data on startup
fetch('./data/destiny_pool.json')
  .then(response => response.json())
  .then(data => {
    gameData = data;
  })
  .catch(err => {
    showBanner("Error loading destiny_pool.json. Make sure you are running via a web server or GitHub Pages.");
    console.error(err);
  });

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function showBanner(message, isExotic = false) {
  spinResult.textContent = message;
  spinResult.classList.remove('hidden', 'exotic-banner');
  if (isExotic) spinResult.classList.add('exotic-banner');
}

// 1. Start New Run
btnNewRun.addEventListener('click', () => {
  if (!gameData) return;

  const classes = Object.keys(gameData.classes);
  const chosenClass = getRandomItem(classes);
  const subclasses = Object.keys(gameData.classes[chosenClass].subclasses);
  const chosenSubclass = getRandomItem(subclasses);

  runState = {
    className: chosenClass,
    subclass: chosenSubclass,
    aspects: [],
    fragments: [],
    artifact: [],
    mods: [],
    exoticArmour: null,
    exoticWeapon: null
  };

  btnSpin.disabled = false;
  btnExotic.disabled = false;
  showBanner(`New Run Started: ${chosenClass} (${chosenSubclass}) — Basic gear only!`);
  updateUI();
});

// 2. Standard Two-Step Spin
btnSpin.addEventListener('click', () => {
  const subclassData = gameData.classes[runState.className].subclasses[runState.subclass];

  // Determine available items per category
  const availableAspects = subclassData.aspects.filter(a => !runState.aspects.includes(a));
  const availableFragments = subclassData.fragments.filter(f => !runState.fragments.includes(f));
  const availableArtifact = gameData.shared.artifactTiers.filter(t => !runState.artifact.includes(t));
  const availableMods = gameData.shared.armorModSlots.filter(m => !runState.mods.includes(m));

  // Build eligible categories
  const eligibleCategories = [];
  if (availableAspects.length > 0) eligibleCategories.push('Aspect');
  if (runState.aspects.length > 0 && availableFragments.length > 0) eligibleCategories.push('Fragment');
  if (availableArtifact.length > 0) eligibleCategories.push('Artifact');
  if (availableMods.length > 0) eligibleCategories.push('Armour Mod');

  if (eligibleCategories.length === 0) {
    showBanner("All standard build elements are already unlocked!");
    btnSpin.disabled = true;
    return;
  }

  // Step 1: Pick Category
  const chosenCategory = getRandomItem(eligibleCategories);
  let unlockedItem = "";

  // Step 2: Pick Item within Category
  if (chosenCategory === 'Aspect') {
    unlockedItem = getRandomItem(availableAspects);
    runState.aspects.push(unlockedItem);
  } else if (chosenCategory === 'Fragment') {
    unlockedItem = getRandomItem(availableFragments);
    runState.fragments.push(unlockedItem);
  } else if (chosenCategory === 'Artifact') {
    unlockedItem = getRandomItem(availableArtifact);
    runState.artifact.push(unlockedItem);
  } else if (chosenCategory === 'Armour Mod') {
    unlockedItem = getRandomItem(availableMods);
    runState.mods.push(unlockedItem);
  }

  showBanner(`Category: ${chosenCategory} ➔ Unlocked: ${unlockedItem}`);
  updateUI();
});

// 3. Separate Exotic Spin
btnExotic.addEventListener('click', () => {
  const rollType = Math.random() < 0.5 ? 'Armour' : 'Weapon';

  if (rollType === 'Armour') {
    const classExotics = gameData.classes[runState.className].exoticArmor;
    // Filter out currently equipped exotic so it always rolls something different
    const pool = classExotics.filter(item => item !== runState.exoticArmour);
    const chosen = getRandomItem(pool);
    runState.exoticArmour = chosen;
    showBanner(`EXOTIC ARMOUR SPIN ➔ Equipped: ${chosen}`, true);
  } else {
    const weaponExotics = gameData.shared.exoticWeapons;
    const pool = weaponExotics.filter(item => item !== runState.exoticWeapon);
    const chosen = getRandomItem(pool);
    runState.exoticWeapon = chosen;
    showBanner(`EXOTIC WEAPON SPIN ➔ Equipped: ${chosen}`, true);
  }

  updateUI();
});

// Update the HTML display
function updateUI() {
  document.getElementById('state-class').textContent = runState.className;
  document.getElementById('state-subclass').textContent = runState.subclass;
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
