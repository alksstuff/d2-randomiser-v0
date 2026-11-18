let gameData = null;
let isSpinning = false;

const SUBCLASS_ELEMENTS = {
    Gunslinger: ["Solar"], Sunbreaker: ["Solar"], Dawnblade: ["Solar"],
    Nightstalker: ["Void"], Sentinel: ["Void"], Voidwalker: ["Void"],
    Arcstrider: ["Arc"], Striker: ["Arc"], Stormcaller: ["Arc"],
    Revenant: ["Stasis"], Behemoth: ["Stasis"], Shadebinder: ["Stasis"],
    Threadrunner: ["Strand"], Berserker: ["Strand"], Broodweaver: ["Strand"],
    Prismatic: ["Prismatic", "Solar", "Void", "Arc", "Stasis", "Strand"]
};

let config = {
    enabledCategories: {
        'Super': true, 'Class Ability': true, 'Jump': true,
        'Melee': true, 'Grenade': true, 'Aspect': true,
        'Fragment': true, 'Artifact': true, 'Armour Mod': true
    },
    includeExoticsInStandard: false,
    enforceSynergy: false,
    startFullSubclass: false
};

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
    synergies: [],
    history: []
};


// DOM Elements
const btnNewRun = document.getElementById('btn-new-run');
const btnSpin = document.getElementById('btn-spin');
const btnToggleConfig = document.getElementById('btn-toggle-config');
const btnExoticAny = document.getElementById('btn-exotic-any');
const btnExoticArmour = document.getElementById('btn-exotic-armour');
const btnExoticWeapon = document.getElementById('btn-exotic-weapon');

const configPanel = document.getElementById('config-panel');
const manualClassSelect = document.getElementById('manual-class');
const manualSubclassSelect = document.getElementById('manual-subclass');
const manualUnlocksContainer = document.getElementById('manual-unlocks-container');
const btnApplyManual = document.getElementById('btn-apply-manual');

const spinDisplay = document.getElementById('spin-display');
const spinCategory = document.getElementById('spin-category');
const spinResult = document.getElementById('spin-result');

// Persistence Helpers
function saveToStorage() {
    try {
        localStorage.setItem('d2_randomiser_state', JSON.stringify(runState));
        localStorage.setItem('d2_randomiser_config', JSON.stringify(config));
    } catch (e) {
        console.warn('Could not save to localStorage:', e);
    }
}

function getDefaultRunState() {
    return {
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
        synergies: [],
        history: []
    };
}

function loadFromStorage() {
    try {
        const savedConfig = localStorage.getItem('d2_randomiser_config');
        if (savedConfig) {
            const parsedConfig = JSON.parse(savedConfig);
            config = {
                ...config,
                ...parsedConfig,
                enabledCategories: {
                    ...config.enabledCategories,
                    ...(parsedConfig.enabledCategories || {})
                }
            };
            syncConfigUI();
        }

        const savedState = localStorage.getItem('d2_randomiser_state');
        if (savedState) {
            const parsed = JSON.parse(savedState);
            if (parsed && parsed.className && gameData.classes[parsed.className]) {
                // Merge with default template so missing arrays from older versions never crash
                runState = { ...getDefaultRunState(), ...parsed };
                updateUI();
                renderHistory();
                setButtonsDisabled(false);
                if (spinCategory) spinCategory.textContent = "RESUMED SAVED RUN";
                if (spinResult) spinResult.textContent = `${runState.className} — ${runState.subclass}`;
            }
        }
    } catch (e) {
        console.warn('Clearing incompatible saved data from localStorage:', e);
        localStorage.removeItem('d2_randomiser_state');
    }
}

function syncConfigUI() {
    document.querySelectorAll('#category-toggles input[data-cat]').forEach(cb => {
        const cat = cb.getAttribute('data-cat');
        cb.checked = Boolean(config.enabledCategories[cat]);
    });
    const exoticToggle = document.getElementById('toggle-exotics-in-standard');
    if (exoticToggle) exoticToggle.checked = Boolean(config.includeExoticsInStandard);
    if (toggleEnforceSynergy) toggleEnforceSynergy.checked = Boolean(config.enforceSynergy);
    const fullStartToggle = document.getElementById('toggle-full-start');
    if (fullStartToggle) fullStartToggle.checked = Boolean(config.startFullSubclass)
}

// Load JSON data
fetch(`./data/destiny_pool.json?v=${Date.now()}`)
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        gameData = data;
        initManualSelectors();
        loadFromStorage();
    })
    .catch(err => {
        if (spinCategory) spinCategory.textContent = "DATA LOAD ERROR";
        if (spinResult) spinResult.textContent = "Could not load data/destiny_pool.json. Check F12 Console.";
        console.error("JSON Load Error:", err);
    });

// Config Panel Listeners
if (btnToggleConfig) {
    btnToggleConfig.addEventListener('click', () => {
        configPanel.classList.toggle('hidden');
        if (!configPanel.classList.contains('hidden') && runState.className) {
            manualClassSelect.value = runState.className;
            populateManualSubclasses();
            manualSubclassSelect.value = runState.subclass;
            renderManualCheckboxes(true);
        }
    });
}

document.querySelectorAll('#category-toggles input[data-cat]').forEach(cb => {
    cb.addEventListener('change', () => {
        const cat = cb.getAttribute('data-cat');
        config.enabledCategories[cat] = cb.checked;
        saveToStorage();
        setButtonsDisabled(false);
    });
});

const toggleExoticsStandard = document.getElementById('toggle-exotics-in-standard');
if (toggleExoticsStandard) {
    toggleExoticsStandard.addEventListener('change', () => {
        config.includeExoticsInStandard = toggleExoticsStandard.checked;
        saveToStorage();
        setButtonsDisabled(false);
    });
}

const toggleEnforceSynergy = document.getElementById('toggle-enforce-synergy');
if (toggleEnforceSynergy) {
    toggleEnforceSynergy.addEventListener('change', () => {
        config.enforceSynergy = toggleEnforceSynergy.checked;
        saveToStorage();
        setButtonsDisabled(false);
    });
}

const toggleFullStart = document.getElementById('toggle-full-start');
if (toggleFullStart) {
    toggleFullStart.addEventListener('change', () => {
        config.startFullSubclass = toggleFullStart.checked;
        saveToStorage();
    });
}

// Manual Setup / Resume Functions
function initManualSelectors() {
    if (!gameData || !manualClassSelect) return;
    manualClassSelect.innerHTML = '';
    Object.keys(gameData.classes).forEach(cls => {
        const opt = document.createElement('option');
        opt.value = cls;
        opt.textContent = cls;
        manualClassSelect.appendChild(opt);
    });
    populateManualSubclasses();
    renderManualCheckboxes(false);
}

function populateManualSubclasses() {
    const cls = manualClassSelect.value;
    manualSubclassSelect.innerHTML = '';
    Object.keys(gameData.classes[cls].subclasses).forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.textContent = sub;
        manualSubclassSelect.appendChild(opt);
    });
}

if (manualClassSelect) {
    manualClassSelect.addEventListener('change', () => {
        populateManualSubclasses();
        renderManualCheckboxes(false);
    });
}

if (manualSubclassSelect) {
    manualSubclassSelect.addEventListener('change', () => {
        const isCurrentBuild = manualClassSelect.value === runState.className && manualSubclassSelect.value === runState.subclass;
        renderManualCheckboxes(isCurrentBuild);
    });
}

function renderManualCheckboxes(preselectCurrent) {
    if (!gameData || !manualUnlocksContainer) return;
    const cls = manualClassSelect.value;
    const sub = manualSubclassSelect.value;
    const subData = gameData.classes[cls].subclasses[sub];

    let classExotics = [...gameData.classes[cls].exoticArmor];
    if (sub === 'Prismatic' && gameData.classes[cls].prismaticClassItem) {
        classExotics.push(gameData.classes[cls].prismaticClassItem);
    }

    const sections = [
        {key: 'supers', title: 'Supers', items: subData.supers},
        {key: 'classAbilities', title: 'Class Abilities', items: subData.classAbilities},
        {key: 'jumps', title: 'Jumps', items: subData.jumps},
        {key: 'melees', title: 'Melees', items: subData.melees},
        {key: 'grenades', title: 'Grenades', items: subData.grenades},
        {key: 'aspects', title: 'Aspects', items: subData.aspects.map(a => a.name)},
        {key: 'fragments', title: 'Fragments', items: subData.fragments},
        {key: 'artifact', title: 'Artifact Tiers', items: gameData.shared.artifactTiers},
        {key: 'mods', title: 'Armour Mod Slots', items: gameData.shared.armorModSlots},
        {key: 'exoticArmour', title: 'Exotic Armour', items: gameData.classes[cls].exoticArmor.map(a => a.name)},
        {key: 'exoticWeapon', title: 'Exotic Weapons', items: gameData.shared.exoticWeapons.map(w => w.name)}
    ];

    manualUnlocksContainer.innerHTML = '';
    sections.forEach(sec => {
        const box = document.createElement('div');
        box.className = 'manual-box';
        const h4 = document.createElement('h4');
        h4.textContent = sec.title;
        box.appendChild(h4);

        sec.items.forEach(item => {
            const label = document.createElement('label');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = item;
            cb.setAttribute('data-manual-key', sec.key);
            if (preselectCurrent && Array.isArray(runState[sec.key]) && runState[sec.key].includes(item)) {
                cb.checked = true;
            }
            label.appendChild(cb);
            label.appendChild(document.createTextNode(' ' + item));
            box.appendChild(label);
        });

        manualUnlocksContainer.appendChild(box);
    });
}

if (btnApplyManual) {
    btnApplyManual.addEventListener('click', () => {
        const cls = manualClassSelect.value;
        const sub = manualSubclassSelect.value;

        const newState = {
            className: cls,
            subclass: sub,
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
            history: runState.className === cls && runState.subclass === sub ? [...runState.history] : []
        };

        manualUnlocksContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            const key = cb.getAttribute('data-manual-key');
            if (newState[key]) {
                newState[key].push(cb.value);
            }
        });

        runState = newState;
        addHistory("Resume", `Loaded manual state for ${cls} (${sub})`, "start");
        updateUI();
        saveToStorage();
        setButtonsDisabled(false);

        if (spinCategory) spinCategory.textContent = "MANUAL BUILD LOADED";
        if (spinResult) spinResult.textContent = `${cls} — ${sub}`;
        configPanel.classList.add('hidden');
    });
}

// Random Helpers
function getRandomItem(array) {
    if (!array || array.length === 0) return "None available";
    return array[Math.floor(Math.random() * array.length)];
}

function getRandomItems(array, count) {
    if (!array || array.length === 0 || count <= 0) return [];
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

function getAvailableExoticArmour() {
    if (!gameData || !runState.className) return { items: [], isFallback: false };
    const allUnowned = gameData.classes[runState.className].exoticArmor
        .filter(armour => !runState.exoticArmour.includes(armour.name));

    if (config.enforceSynergy) {
        const synergistic = allUnowned.filter(armour => {
            // Strictly check subclass compatibility first (never let generic tags bypass subclass)
            const isNeutral = armour.subclasses.includes("Any");
            const matchesSub = armour.subclasses.includes(runState.subclass);
            if (!isNeutral && !matchesSub) return false;

            // Optional extra check: if an exotic requires a specific Super/Ability (tagged with "Requires: ..."), check it
            const requirements = (armour.tags || []).filter(t => t.startsWith("Requires:"));
            if (requirements.length > 0) {
                return requirements.some(req => runState.synergies.includes(req.replace("Requires:", "").trim()));
            }

            return true;
        });

        if (synergistic.length > 0) {
            return { items: synergistic.map(a => a.name), isFallback: false };
        }
        if (allUnowned.length > 0) {
            return { items: allUnowned.map(a => a.name), isFallback: true };
        }
    }

    return { items: allUnowned.map(a => a.name), isFallback: false };
}

function getAvailableExoticWeapons() {
    if (!gameData) return { items: [], isFallback: false };
    const allUnowned = gameData.shared.exoticWeapons
        .filter(weapon => !runState.exoticWeapon.includes(weapon.name));

    if (config.enforceSynergy) {
        const synergistic = allUnowned.filter(weapon => {
            const isUniversal = weapon.elements.includes("Any") || weapon.elements.includes("Kinetic");
            const matchesElement = weapon.elements.some(el => runState.synergies.includes(el));
            const matchesSyn = (weapon.synergies || []).some(s => runState.synergies.includes(s));
            return isUniversal || matchesElement || matchesSyn;
        });

        if (synergistic.length > 0) {
            return { items: synergistic.map(w => w.name), isFallback: false };
        }
        if (allUnowned.length > 0) {
            return { items: allUnowned.map(w => w.name), isFallback: true };
        }
    }

    return { items: allUnowned.map(w => w.name), isFallback: false };
}


function setButtonsDisabled(disabled) {
    const hasRun = Boolean(runState.className);
    const availArmour = getAvailableExoticArmour().items.length > 0;
    const availWeapons = getAvailableExoticWeapons().items.length > 0;

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
            saveToStorage();
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

// 1. Start New Run
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

        let startAspects = [];
        let startFragments = [];

        if (config.startFullSubclass) {
            const pickedAspectObjs = getRandomItems(subData.aspects, 2);
            startAspects = pickedAspectObjs.map(a => a.name);
            const totalFragmentSlots = pickedAspectObjs.reduce((sum, a) => sum + (a.slots || 2), 0);
            startFragments = getRandomItems(subData.fragments, totalFragmentSlots);
        }

        // ... inside animateSpin callback:
        runState = {
            className: chosenClass,
            subclass: chosenSubclass,
            supers: [startSuper],
            classAbilities: [startClassAbility],
            jumps: [startJump],
            melees: [startMelee],
            grenades: [startGrenade],
            aspects: startAspects,
            fragments: startFragments,
            artifact: [],
            mods: [],
            exoticArmour: [],
            exoticWeapon: [],
            synergies: [],
            history: []
        };

        const startSummary = config.startFullSubclass
            ? `${chosenClass} (${chosenSubclass}) — Full Subclass Rolled (${startAspects.length} Aspects, ${startFragments.length} Fragments)`
            : `${chosenClass} (${chosenSubclass}) — Basic gear only`;

        addHistory("Start", startSummary, "start");
        updateUI();
    });
}
// 2. Standard Two-Step Spin (Respects Config Toggles + Optional Exotics)
if (btnSpin) {
    btnSpin.addEventListener('click', () => {
        if (isSpinning || !runState.className) return;
        const subclassData = gameData.classes[runState.className].subclasses[runState.subclass];
        const pools = {
            'Super': subclassData.supers.filter(s => !runState.supers.includes(s)),
            'Class Ability': subclassData.classAbilities.filter(c => !runState.classAbilities.includes(c)),
            'Jump': subclassData.jumps.filter(j => !runState.jumps.includes(j)),
            'Melee': subclassData.melees.filter(m => !runState.melees.includes(m)),
            'Grenade': subclassData.grenades.filter(g => !runState.grenades.includes(g)),
            'Aspect': subclassData.aspects.map(a => a.name).filter(a => !runState.aspects.includes(a)),
            'Fragment': runState.aspects.length > 0 ? subclassData.fragments.filter(f => !runState.fragments.includes(f)) : [],
            'Artifact': gameData.shared.artifactTiers.filter(t => !runState.artifact.includes(t)),
            'Armour Mod': gameData.shared.armorModSlots.filter(m => !runState.mods.includes(m))
        };
        const eligibleCategories = [];
        Object.keys(pools).forEach(cat => {
            if (config.enabledCategories[cat] && pools[cat].length > 0) {
                eligibleCategories.push(cat);
            }
        });
        let fallbackFlags = { 'Exotic Armour': false, 'Exotic Weapon': false };

        if (config.includeExoticsInStandard) {
            const armourData = getAvailableExoticArmour();
            const weaponData = getAvailableExoticWeapons();
            if (armourData.items.length > 0) {
                pools['Exotic Armour'] = armourData.items;
                fallbackFlags['Exotic Armour'] = armourData.isFallback;
                eligibleCategories.push('Exotic Armour');
            }
            if (weaponData.items.length > 0) {
                pools['Exotic Weapon'] = weaponData.items;
                fallbackFlags['Exotic Weapon'] = weaponData.isFallback;
                eligibleCategories.push('Exotic Weapon');
            }
        }

        if (eligibleCategories.length === 0) {
            if (spinCategory) spinCategory.textContent = "NO ELIGIBLE ITEMS";
            if (spinResult) spinResult.textContent = "All enabled categories are unlocked (or disabled in Config)!";
            return;
        }

        const chosenCategory = getRandomItem(eligibleCategories);
        const targetPool = pools[chosenCategory];
        const unlockedItem = getRandomItem(targetPool);
        const visualPool = targetPool.length > 1 ? targetPool : [unlockedItem, "Decrypting Engram...", "Scanning Subclass..."];
        const isExotic = chosenCategory === 'Exotic Armour' || chosenCategory === 'Exotic Weapon';
        const isWildcard = Boolean(fallbackFlags[chosenCategory]);

        const bannerTitle = isWildcard
            ? `CATEGORY: ${chosenCategory.toUpperCase()} (WILDCARD FALLBACK)`
            : `CATEGORY: ${chosenCategory.toUpperCase()}`;

        animateSpin(bannerTitle, visualPool, unlockedItem, isExotic ? 'exotic-win' : '', () => {
            if (chosenCategory === 'Super') runState.supers.push(unlockedItem);
            else if (chosenCategory === 'Class Ability') runState.classAbilities.push(unlockedItem);
            else if (chosenCategory === 'Jump') runState.jumps.push(unlockedItem);
            else if (chosenCategory === 'Melee') runState.melees.push(unlockedItem);
            else if (chosenCategory === 'Grenade') runState.grenades.push(unlockedItem);
            else if (chosenCategory === 'Aspect') runState.aspects.push(unlockedItem);
            else if (chosenCategory === 'Fragment') runState.fragments.push(unlockedItem);
            else if (chosenCategory === 'Artifact') runState.artifact.push(unlockedItem);
            else if (chosenCategory === 'Armour Mod') runState.mods.push(unlockedItem);
            else if (chosenCategory === 'Exotic Armour') runState.exoticArmour.push(unlockedItem);
            else if (chosenCategory === 'Exotic Weapon') runState.exoticWeapon.push(unlockedItem);

            const badgeLabel = isWildcard ? `${chosenCategory} • Wildcard` : chosenCategory;
            const badgeStyle = isWildcard ? 'wildcard' : (isExotic ? 'exotic' : '');
            addHistory(badgeLabel, `Unlocked ${unlockedItem}`, badgeStyle);
            updateUI();
        });
    });
}

// 3. Dedicated Exotic Spin Handlers
function handleExoticSpin(mode) {
    if (isSpinning || !runState.className) return;

    const armourData = getAvailableExoticArmour();
    const weaponData = getAvailableExoticWeapons();

    let rollType = mode;
    if (mode === 'any') {
        if (armourData.items.length > 0 && weaponData.items.length > 0) {
            rollType = Math.random() < 0.5 ? 'armour' : 'weapon';
        } else if (armourData.items.length > 0) {
            rollType = 'armour';
        } else if (weaponData.items.length > 0) {
            rollType = 'weapon';
        } else {
            return;
        }
    }

    if (rollType === 'armour' && armourData.items.length > 0) {
        const chosen = getRandomItem(armourData.items);
        const visualPool = armourData.items.length > 1 ? armourData.items : [chosen, "Decrypting Exotic Engram..."];
        const label = armourData.isFallback
            ? `EXOTIC ${runState.className.toUpperCase()} ARMOUR (WILDCARD FALLBACK)`
            : `EXOTIC ${runState.className.toUpperCase()} ARMOUR`;

        animateSpin(label, visualPool, chosen, 'exotic-win', () => {
            runState.exoticArmour.push(chosen);
            const badgeText = armourData.isFallback ? "Exotic Armour • Wildcard" : "Exotic Armour";
            const badgeClass = armourData.isFallback ? "wildcard" : "exotic";
            addHistory(badgeText, `Unlocked ${chosen}`, badgeClass);
            updateUI();
        });

    } else if (rollType === 'weapon' && weaponData.items.length > 0) {
        const chosen = getRandomItem(weaponData.items);
        const visualPool = weaponData.items.length > 1 ? weaponData.items : [chosen, "Decrypting Exotic Engram..."];
        const label = weaponData.isFallback
            ? "EXOTIC WEAPON (WILDCARD FALLBACK)"
            : "EXOTIC WEAPON";

        animateSpin(label, visualPool, chosen, 'exotic-win', () => {
            runState.exoticWeapon.push(chosen);
            const badgeText = weaponData.isFallback ? "Exotic Weapon • Wildcard" : "Exotic Weapon";
            const badgeClass = weaponData.isFallback ? "wildcard" : "exotic";
            addHistory(badgeText, `Unlocked ${chosen}`, badgeClass);
            updateUI();
        });
    }
}

if (btnExoticAny) btnExoticAny.addEventListener('click', () => handleExoticSpin('any'));
if (btnExoticArmour) btnExoticArmour.addEventListener('click', () => handleExoticSpin('armour'));
if (btnExoticWeapon) btnExoticWeapon.addEventListener('click', () => handleExoticSpin('weapon'));

// Update the HTML display
function updateUI() {
    recalculateSynergies();
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
    renderSynergies();
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
        li.innerHTML = `<span><strong>#${entry.step}</strong> ${entry.text}</span> <span class="badge ${entry.type}">${entry.badge}</span>`;
        ul.appendChild(li);
    });
}

function recalculateSynergies() {
    if (!gameData || !runState.className) {
        runState.synergies = [];
        return;
    }

    const tagSet = new Set();

    // 1. Add Subclass & its native Element(s)
    tagSet.add(runState.subclass);
    (SUBCLASS_ELEMENTS[runState.subclass] || []).forEach(el => tagSet.add(el));

    // 2. Add all unlocked Supers, Class Abilities, Jumps, Melees, Grenades, Aspects, Fragments
    [
        ...runState.supers,
        ...runState.classAbilities,
        ...runState.jumps,
        ...runState.melees,
        ...runState.grenades,
        ...runState.aspects,
        ...runState.fragments
    ].forEach(ability => tagSet.add(ability));

    // 3. Add unlocked Exotic Armour names & tags
    const allArmour = gameData.classes[runState.className].exoticArmor;
    runState.exoticArmour.forEach(name => {
        tagSet.add(name);
        const obj = allArmour.find(a => a.name === name);
        if (obj && obj.tags) obj.tags.forEach(t => tagSet.add(t));
    });

    // 4. Add unlocked Exotic Weapon names, elements & synergies
    const allWeapons = gameData.shared.exoticWeapons;
    runState.exoticWeapon.forEach(name => {
        tagSet.add(name);
        const obj = allWeapons.find(w => w.name === name);
        if (obj) {
            (obj.elements || []).forEach(el => tagSet.add(el));
            (obj.synergies || []).forEach(syn => tagSet.add(syn));
        }
    });

    runState.synergies = Array.from(tagSet);
}

function renderSynergies() {
    const container = document.getElementById('list-synergies');
    const countEl = document.getElementById('synergy-count');
    if (!container) return;

    if (countEl) countEl.textContent = runState.synergies.length;
    container.innerHTML = '';

    if (runState.synergies.length === 0) {
        container.innerHTML = '<span class="muted">No synergies active yet.</span>';
        return;
    }

    runState.synergies.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'synergy-pill';
        span.textContent = tag;
        container.appendChild(span);
    });
}
