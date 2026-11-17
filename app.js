let gameData = null;
let isSpinning = false;

let runState = {
    className: null,
    subclass: null,
    supers: [],
    classAbilities: [],
    jumps: [],
    melees: [],
    grenades: [],
    aspects: [],
    fragments: [],
    artifact: [],
    mods: [],
    exoticArmour: [],
    exoticWeapon: [],
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

// Load JSON data with cache-busting timestamp
fetch(`./data/destiny_pool.json?v=${Date.now()}`)
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        gameData = data;
        console.log("Destiny pool loaded successfully.");
    })
    .catch(err => {
        if (spinCategory) spinCategory.textContent = "DATA LOAD ERROR";
        if (spinResult) spinResult.textContent = "Could not load data/destiny_pool.json. Check F12 Console.";
        console.error("JSON Load Error:", err);
    });

function getRandomItem(array) {
    if (!array || array.length === 0) return "None available";
    return array[Math.floor(Math.random() * array.length)];
}

function getAvailableExoticArmour() {
    if (!gameData || !runState.className) return [];
    let classExotics = [...gameData.classes[runState.className].exoticArmor];
    if (runState.subclass === 'Prismatic' && gameData.classes[runState.className].prismaticClassItem) {
        classExotics.push(gameData.classes[runState.className].prismaticClassItem);
    }
    return classExotics.filter(item => !runState.exoticArmour.includes(item));
}

function getAvailableExoticWeapons() {
    if (!gameData) return [];
    return gameData.shared.exoticWeapons.filter(item => !runState.exoticWeapon.includes(item));
}

function setButtonsDisabled(disabled) {
    const hasRun = Boolean(runState.className);
    const availArmour = getAvailableExoticArmour().length > 0;
    const availWeapons = getAvailableExoticWeapons().length > 0;

    if (btnNewRun) btnNewRun.disabled = disabled;
    if (btnSpin) btnSpin.disabled = disabled || !hasRun;
    if (btnExoticAny) btnExoticAny.disabled = disabled || !hasRun || (!availArmour && !availWeapons);
    if (btnExoticArmour) btnExoticArmour.disabled = disabled || !hasRun || !availArmour;
    if (btnExoticWeapon) btnExoticWeapon.disabled = disabled || !hasRun || !availWeapons;
}

// Visual Spin Animation Helper
function animateSpin(categoryLabel, poolArray, finalResult, styleClass, onComplete) {
    isSpinning = true;
    setButtonsDisabled(true);

    if (spinDisplay) spinDisplay.className = 'spinner-box spinning';
    if (spinCategory) spinCategory.textContent = categoryLabel;

    let ticks = 0;
    const maxTicks = 18;
    const interval = setInterval(() => {
        if (spinResult) spinResult.textContent = getRandomItem(poolArray);
        ticks++;

        if (ticks >= maxTicks) {
            clearInterval(interval);
            if (spinResult) spinResult.textContent = finalResult;
            if (spinDisplay) spinDisplay.className = `spinner-box ${styleClass}`;
            isSpinning = false;
            onComplete();
            setButtonsDisabled(false);
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

// 1. Start New Run (Rolls Class, Subclass, Super, and 1 baseline of each ability)
if (btnNewRun) {
    btnNewRun.addEventListener('click', () => {
        if (!gameData || isSpinning) return;

        const classes = Object.keys(gameData.classes);
        const chosenClass = getRandomItem(classes);
        const subclasses = Object.keys(gameData.classes[chosenClass].subclasses);
        const chosenSubclass = getRandomItem(subclasses);

        const subData = gameData.classes[chosenClass].subclasses[chosenSubclass];
        const startSuper = getRandomItem(subData.supers);
        const startClassAbility = getRandomItem(subData.classAbilities);
        const startJump = getRandomItem(subData.jumps);
        const startMelee = getRandomItem(subData.melees);
        const startGrenade = getRandomItem(subData.grenades);

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
                supers: [startSuper],
                classAbilities: [startClassAbility],
                jumps: [startJump],
                melees: [startMelee],
                grenades: [startGrenade],
                aspects: [],
                fragments: [],
                artifact: [],
                mods: [],
                exoticArmour: [],
                exoticWeapon: [],
                history: []
            };

            if (spinCategory) spinCategory.textContent = "STARTING RUN STATE";
            addHistory(
                "Start",
                `${chosenClass} (${chosenSubclass}) | Super: ${startSuper} | Kit: ${startClassAbility}, ${startJump}, ${startMelee}, ${startGrenade}`,
                "start"
            );
            updateUI();
        });
    });
}

// 2. Standard Two-Step Spin
if (btnSpin) {
    btnSpin.addEventListener('click', () => {
        if (isSpinning || !runState.className) return;

        const subclassData = gameData.classes[runState.className].subclasses[runState.subclass];

        const availableSupers = subclassData.supers.filter(s => !runState.supers.includes(s));
        const availableClassAbilities = subclassData.classAbilities.filter(c => !runState.classAbilities.includes(c));
        const availableJumps = subclassData.jumps.filter(j => !runState.jumps.includes(j));
        const availableMelees = subclassData.melees.filter(m => !runState.melees.includes(m));
        const availableGrenades = subclassData.grenades.filter(g => !runState.grenades.includes(g));
        const availableAspects = subclassData.aspects.filter(a => !runState.aspects.includes(a));
        const availableFragments = subclassData.fragments.filter(f => !runState.fragments.includes(f));
        const availableArtifact = gameData.shared.artifactTiers.filter(t => !runState.artifact.includes(t));
        const availableMods = gameData.shared.armorModSlots.filter(m => !runState.mods.includes(m));

        const eligibleCategories = [];
        if (availableSupers.length > 0) eligibleCategories.push('Super');
        if (availableClassAbilities.length > 0) eligibleCategories.push('Class Ability');
        if (availableJumps.length > 0) eligibleCategories.push('Jump');
        if (availableMelees.length > 0) eligibleCategories.push('Melee');
        if (availableGrenades.length > 0) eligibleCategories.push('Grenade');
        if (availableAspects.length > 0) eligibleCategories.push('Aspect');
        if (runState.aspects.length > 0 && availableFragments.length > 0) eligibleCategories.push('Fragment');
        if (availableArtifact.length > 0) eligibleCategories.push('Artifact');
        if (availableMods.length > 0) eligibleCategories.push('Armour Mod');

        if (eligibleCategories.length === 0) {
            if (spinCategory) spinCategory.textContent = "MAXED OUT";
            if (spinResult) spinResult.textContent = "All standard build elements are already unlocked!";
            btnSpin.disabled = true;
            return;
        }

        const chosenCategory = getRandomItem(eligibleCategories);
        let targetPool = [];

        if (chosenCategory === 'Super') targetPool = availableSupers;
        else if (chosenCategory === 'Class Ability') targetPool = availableClassAbilities;
        else if (chosenCategory === 'Jump') targetPool = availableJumps;
        else if (chosenCategory === 'Melee') targetPool = availableMelees;
        else if (chosenCategory === 'Grenade') targetPool = availableGrenades;
        else if (chosenCategory === 'Aspect') targetPool = availableAspects;
        else if (chosenCategory === 'Fragment') targetPool = availableFragments;
        else if (chosenCategory === 'Artifact') targetPool = availableArtifact;
        else if (chosenCategory === 'Armour Mod') targetPool = availableMods;

        const unlockedItem = getRandomItem(targetPool);
        const visualPool = targetPool.length > 1 ? targetPool : [unlockedItem, "Decrypting Engram...", "Scanning Subclass..."];

        animateSpin(`CATEGORY: ${chosenCategory.toUpperCase()}`, visualPool, unlockedItem, '', () => {
            if (chosenCategory === 'Super') runState.supers.push(unlockedItem);
            if (chosenCategory === 'Class Ability') runState.classAbilities.push(unlockedItem);
            if (chosenCategory === 'Jump') runState.jumps.push(unlockedItem);
            if (chosenCategory === 'Melee') runState.melees.push(unlockedItem);
            if (chosenCategory === 'Grenade') runState.grenades.push(unlockedItem);
            if (chosenCategory === 'Aspect') runState.aspects.push(unlockedItem);
            if (chosenCategory === 'Fragment') runState.fragments.push(unlockedItem);
            if (chosenCategory === 'Artifact') runState.artifact.push(unlockedItem);
            if (chosenCategory === 'Armour Mod') runState.mods.push(unlockedItem);

            addHistory(chosenCategory, `Unlocked ${unlockedItem}`);
            updateUI();
        });
    });
}

// 3. Exotic Spin Handlers
function handleExoticSpin(mode) {
    if (isSpinning || !runState.className) return;

    const availArmour = getAvailableExoticArmour();
    const availWeapons = getAvailableExoticWeapons();

    let rollType = mode;
    if (mode === 'any') {
        if (availArmour.length > 0 && availWeapons.length > 0) {
            rollType = Math.random() < 0.5 ? 'armour' : 'weapon';
        } else if (availArmour.length > 0) {
            rollType = 'armour';
        } else if (availWeapons.length > 0) {
            rollType = 'weapon';
        } else {
            return;
        }
    }
    if (rollType === 'armour' && availArmour.length > 0) {
        const chosen = getRandomItem(availArmour);
        const visualPool = availArmour.length > 1 ? availArmour : [chosen, "Decrypting Exotic Engram..."];
        animateSpin(`EXOTIC ${runState.className.toUpperCase()} ARMOUR`, visualPool, chosen, 'exotic-win', () => {
            runState.exoticArmour.push(chosen);
            addHistory("Exotic Armour", `Unlocked ${chosen}`, "exotic");
            updateUI();
        });
    } else if (rollType === 'weapon' && availWeapons.length > 0) {
        const chosen = getRandomItem(availWeapons);
        const visualPool = availWeapons.length > 1 ? availWeapons : [chosen, "Decrypting Exotic Engram..."];
        animateSpin("EXOTIC WEAPON", visualPool, chosen, 'exotic-win', () => {
            runState.exoticWeapon.push(chosen);
            addHistory("Exotic Weapon", `Unlocked ${chosen}`, "exotic");
            updateUI();
        });
    }
}

if (btnExoticAny) btnExoticAny.addEventListener('click', () => handleExoticSpin('any'));
if (btnExoticArmour) btnExoticArmour.addEventListener('click', () => handleExoticSpin('armour'));
if (btnExoticWeapon) btnExoticWeapon.addEventListener('click', () => handleExoticSpin('weapon'));

// Update the HTML display
function updateUI() {
    const elClass = document.getElementById('state-class');
    const elSub = document.getElementById('state-subclass');
    if (elClass) elClass.textContent = runState.className;
    if (elSub) {
        elSub.textContent = runState.subclass;
        elSub.className = runState.subclass === 'Prismatic' ? 'prismatic-text' : '';
    }
    renderList('list-supers', runState.supers, 'Not rolled');
    renderList('list-class-abilities', runState.classAbilities, 'None');
    renderList('list-jumps', runState.jumps, 'None');
    renderList('list-melees', runState.melees, 'None');
    renderList('list-grenades', runState.grenades, 'None');
    renderList('list-exotic-armour', runState.exoticArmour, 'None unlocked', true);
    renderList('list-exotic-weapon', runState.exoticWeapon, 'None unlocked', true);
    renderList('list-aspects', runState.aspects, 'None unlocked');
    const fragEmptyText = runState.aspects.length === 0
        ? 'Locked (Requires 1 Aspect)'
        : 'None unlocked';
    renderList('list-fragments', runState.fragments, fragEmptyText);
    renderList('list-artifact', runState.artifact, 'None unlocked');
    renderList('list-mods', runState.mods, 'None unlocked');
}

function renderList(elementId, items, emptyMessage, isExotic = false) {
    const ul = document.getElementById(elementId);
    if (!ul) return;
    ul.innerHTML = '';
    if (items.length === 0) {
        const li = document.createElement('li');
        li.textContent = emptyMessage;
        if (isExotic) {
            li.className = 'muted';
        } else {
            li.style.color = '#8b949e';
        }
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
    if (!ul) return;
    ul.innerHTML = '';
    if (runState.history.length === 0) {
        ul.innerHTML = 'No actions recorded yet.';
        return;
    }
    runState.history.forEach(entry => {
        const li = document.createElement('li');
        li.innerHTML = `<span><strong>#${entry.step}</strong> &nbsp;${entry.text}</span> <span class="badge ${entry.type}">${entry.badge}</span>`;
        ul.appendChild(li);
    });
}