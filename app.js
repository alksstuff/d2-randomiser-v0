let gameData = null;
let isSpinning = false;
let pendingDraftChoices = [];
let runTimerInterval = null;

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
        'Subclass': false,
        'Super': true,
        'Class Ability': true,
        'Jump': true,
        'Melee': true,
        'Grenade': true,
        'Aspect': true,
        'Fragment': true,
        'Artifact': true,
        'Armour Mod': true
    },
    includeExoticsInStandard: false,
    enforceSynergy: false,
    startFullSubclass: false,
    rogueliteMode: false,
    enableDungeonGauntlet: false,
    dungeonOrder: 'release',
    dungeonCount: 3
};

function getEmptySubclassKit() {
    return {
        supers: [],
        classAbilities: [],
        jumps: [],
        melees: [],
        grenades: [],
        aspects: [],
        fragments: []
    };
}

function getDefaultRunState() {
    return {
        className: null,
        activeSubclass: null,
        unlockedSubclasses: [],
        subclassData: {},
        artifact: [],
        mods: [],
        exoticArmour: [],
        exoticWeapon: [],
        synergies: [],
        dungeons: [],
        currentDungeonIndex: 0,
        encountersCleared: 0,
        deaths: 0,
        elapsedSeconds: 0,
        timerRunning: false,
        history: []
    };
}

let runState = getDefaultRunState();

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

const toggleDungeonGauntlet = document.getElementById('toggle-dungeon-gauntlet');
const dungeonCard = document.getElementById('dungeon-card');
const dungeonSettingsControls = document.getElementById('dungeon-settings-controls');

const dungeonOrderSelect = document.getElementById('dungeon-order');
const dungeonCountInput = document.getElementById('dungeon-count');
const btnRollDungeons = document.getElementById('btn-roll-dungeons');

const statTimerEl = document.getElementById('stat-timer');
const btnToggleTimer = document.getElementById('btn-toggle-timer');
const btnFinishEncounter = document.getElementById('btn-finish-encounter');
const btnAddDeath = document.getElementById('btn-add-death');

const spinDisplay = document.getElementById('spin-display');
const spinCategory = document.getElementById('spin-category');
const spinResult = document.getElementById('spin-result');
const draftContainer = document.getElementById('draft-container');
const draftCards = document.getElementById('draft-cards');

function getActiveKit() {
    if (!runState.activeSubclass) return getEmptySubclassKit();
    if (!runState.subclassData[runState.activeSubclass]) {
        runState.subclassData[runState.activeSubclass] = getEmptySubclassKit();
    }
    return runState.subclassData[runState.activeSubclass];
}

function generateSubclassKit(className, subclassName, isFull) {
    const subPool = gameData.classes[className].subclasses[subclassName];
    const kit = getEmptySubclassKit();

    kit.supers = [getRandomItem(subPool.supers)];
    kit.classAbilities = [getRandomItem(subPool.classAbilities)];
    kit.jumps = [getRandomItem(subPool.jumps)];
    kit.melees = [getRandomItem(subPool.melees)];
    kit.grenades = [getRandomItem(subPool.grenades)];

    if (isFull) {
        const pickedAspectObjs = getRandomItems(subPool.aspects, 2);
        kit.aspects = pickedAspectObjs.map(a => typeof a === 'string' ? a : a.name);
        const totalSlots = pickedAspectObjs.reduce((sum, a) => sum + (typeof a === 'object' && a.slots ? a.slots : 2), 0);
        kit.fragments = getRandomItems(subPool.fragments, totalSlots);
    }

    return kit;
}

function generateDungeonPlaylist() {
    if (!gameData || !gameData.shared || !gameData.shared.dungeons) return [];
    const allDungeons = [...gameData.shared.dungeons];
    const count = Math.max(1, Math.min(allDungeons.length, parseInt(config.dungeonCount, 10) || 3));

    let selected;
    if (config.dungeonOrder === 'chaos') {
        selected = getRandomItems(allDungeons, count);
    } else {
        selected = allDungeons.slice(0, count);
    }

    return selected.map(d => ({
        name: d.name,
        encountersTotal: d.encounters || 3,
        encountersDone: 0,
        completed: false,
        completedAt: null
    }));
}

function clearDraft() {
    pendingDraftChoices = [];
    if (draftContainer) draftContainer.classList.add('hidden');
    if (draftCards) draftCards.innerHTML = '';
}

// Timer Helpers
function formatDuration(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return [hrs, mins, secs].map(v => String(v).padStart(2, '0')).join(':');
}

function updateTimerDisplay() {
    if (statTimerEl) {
        statTimerEl.textContent = formatDuration(runState.elapsedSeconds || 0);
    }
    if (btnToggleTimer) {
        btnToggleTimer.textContent = runState.timerRunning ? '⏸ Pause' : '▶ Resume';
    }
}

function startRunTimer() {
    if (runTimerInterval) clearInterval(runTimerInterval);
    runState.timerRunning = true;
    updateTimerDisplay();

    runTimerInterval = setInterval(() => {
        if (!runState.timerRunning) return;
        runState.elapsedSeconds = (runState.elapsedSeconds || 0) + 1;
        updateTimerDisplay();

        if (runState.elapsedSeconds % 5 === 0) {
            saveToStorage();
        }
    }, 1000);
}

function stopRunTimer() {
    runState.timerRunning = false;
    if (runTimerInterval) {
        clearInterval(runTimerInterval);
        runTimerInterval = null;
    }
    updateTimerDisplay();
    saveToStorage();
}

if (btnToggleTimer) {
    btnToggleTimer.addEventListener('click', () => {
        if (!runState.className) return;
        if (runState.timerRunning) {
            stopRunTimer();
        } else {
            startRunTimer();
            saveToStorage();
        }
    });
}

// Storage Helpers
function saveToStorage() {
    try {
        localStorage.setItem('d2_randomiser_state', JSON.stringify(runState));
        localStorage.setItem('d2_randomiser_config', JSON.stringify(config));
    } catch (e) {
        console.warn('Could not save to localStorage:', e);
    }
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
            if (parsed && parsed.className && parsed.activeSubclass && parsed.subclassData && gameData.classes[parsed.className]) {
                runState = {...getDefaultRunState(), ...parsed};
                updateUI();
                renderHistory();
                setButtonsDisabled(false);

                if (runState.timerRunning) {
                    startRunTimer();
                } else {
                    updateTimerDisplay();
                }

                if (spinCategory) spinCategory.textContent = "RESUMED SAVED RUN";
                if (spinResult) spinResult.textContent = `${runState.className} — ${runState.activeSubclass}`;
            } else if (parsed) {
                localStorage.removeItem('d2_randomiser_state');
            }
        }
    } catch (e) {
        console.warn('Clearing incompatible saved data:', e);
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

    const synergyToggle = document.getElementById('toggle-enforce-synergy');
    if (synergyToggle) synergyToggle.checked = Boolean(config.enforceSynergy);

    const fullStartToggle = document.getElementById('toggle-full-start');
    if (fullStartToggle) fullStartToggle.checked = Boolean(config.startFullSubclass);

    const rogueliteToggle = document.getElementById('toggle-roguelite');
    if (rogueliteToggle) rogueliteToggle.checked = Boolean(config.rogueliteMode);

    if (toggleDungeonGauntlet) {
        toggleDungeonGauntlet.checked = Boolean(config.enableDungeonGauntlet);
    }
    applyDungeonVisibility();

    if (dungeonOrderSelect) dungeonOrderSelect.value = config.dungeonOrder || 'release';
    if (dungeonCountInput) dungeonCountInput.value = config.dungeonCount || 3;
}

// Load JSON Data
fetch(`./data/destiny_pool.json?v=${Date.now()}`)
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        gameData = data;
        if (dungeonCountInput && data.shared && data.shared.dungeons) {
            dungeonCountInput.max = data.shared.dungeons.length;
        }
        initManualSelectors();
        loadFromStorage();
        console.log("Destiny pool loaded successfully.");
    })
    .catch(err => {
        if (spinCategory) spinCategory.textContent = "DATA LOAD ERROR";
        if (spinResult) spinResult.textContent = "Could not load data/destiny_pool.json. Check F12 Console.";
        console.error("JSON Load Error:", err);
    });

// Config Panel Listeners
if (btnToggleConfig) {
    btnToggleConfig.addEventListener('click', () => {
        if (!configPanel) return;
        configPanel.classList.toggle('hidden');
        if (!configPanel.classList.contains('hidden') && runState.className) {
            manualClassSelect.value = runState.className;
            populateManualSubclasses();
            manualSubclassSelect.value = runState.activeSubclass;
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
const toggleRoguelite = document.getElementById('toggle-roguelite');
if (toggleRoguelite) {
    toggleRoguelite.addEventListener('change', () => {
        config.rogueliteMode = toggleRoguelite.checked;
        saveToStorage();
    });
}
if (toggleDungeonGauntlet) {
    toggleDungeonGauntlet.addEventListener('change', () => {
        config.enableDungeonGauntlet = toggleDungeonGauntlet.checked;
        applyDungeonVisibility();

        if (!config.enableDungeonGauntlet && runState.timerRunning) {
            stopRunTimer();
        } else if (config.enableDungeonGauntlet && runState.className && (!runState.dungeons || runState.dungeons.length === 0)) {
            runState.dungeons = generateDungeonPlaylist();
            runState.currentDungeonIndex = 0;
            updateUI();
        }

        saveToStorage();
        setButtonsDisabled(false);
    });
}
if (dungeonOrderSelect) {
    dungeonOrderSelect.addEventListener('change', () => {
        config.dungeonOrder = dungeonOrderSelect.value;
        saveToStorage();
    });
}
if (dungeonCountInput) {
    dungeonCountInput.addEventListener('change', () => {
        config.dungeonCount = parseInt(dungeonCountInput.value, 10) || 3;
        saveToStorage();
    });
}
if (btnRollDungeons) {
    btnRollDungeons.addEventListener('click', () => {
        if (!gameData) return;
        runState.dungeons = generateDungeonPlaylist();
        runState.currentDungeonIndex = 0;
        addHistory("Gauntlet", `Generated ${runState.dungeons.length} dungeons (${config.dungeonOrder} order)`, "dungeon");
        updateUI();
        saveToStorage();
        setButtonsDisabled(false);
    });
}
// Dungeon Progress Buttons (With Split Timestamps)
if (btnFinishEncounter) {
    btnFinishEncounter.addEventListener('click', () => {
        if (!runState.dungeons || runState.currentDungeonIndex >= runState.dungeons.length) return;
        const current = runState.dungeons[runState.currentDungeonIndex];
        const split = formatDuration(runState.elapsedSeconds || 0);

        current.encountersDone += 1;
        runState.encountersCleared += 1;

        const totalEncounters = current.encountersTotal || 3;

        if (current.encountersDone >= totalEncounters) {
            current.completed = true;
            current.completedAt = split;
            runState.currentDungeonIndex += 1;

            const isGauntletFinished = runState.currentDungeonIndex >= runState.dungeons.length;
            if (isGauntletFinished) {
                stopRunTimer();
            }

            const nextMsg = !isGauntletFinished
                ? `Next up: ${runState.dungeons[runState.currentDungeonIndex].name}`
                : `Gauntlet completed in ${split}!`;

            addHistory(
                "Dungeon Clear",
                `[${split}] Cleared final encounter (${current.encountersDone}/${totalEncounters}) & completed ${current.name}! ${nextMsg}`,
                "dungeon"
            );
        } else {
            addHistory(
                "Encounter",
                `[${split}] Cleared Encounter ${current.encountersDone}/${totalEncounters} in ${current.name}`,
                "dungeon"
            );
        }

        updateUI();
        saveToStorage();
        setButtonsDisabled(false);
    });
}
if (btnAddDeath) {
    btnAddDeath.addEventListener('click', () => {
        runState.deaths += 1;
        const split = formatDuration(runState.elapsedSeconds || 0);
        const loc = (runState.dungeons && runState.currentDungeonIndex < runState.dungeons.length)
            ? `in ${runState.dungeons[runState.currentDungeonIndex].name}`
            : '';
        addHistory("Death", `[${split}] Guardian Down${loc} (Total Deaths: ${runState.deaths})`, "death");
        updateUI();
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
    if (!manualClassSelect || !manualSubclassSelect) return;
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
        const isUnlockedSub = manualClassSelect.value === runState.className &&
            runState.unlockedSubclasses.includes(manualSubclassSelect.value);
        renderManualCheckboxes(isUnlockedSub);
    });
}

function renderManualCheckboxes(preselectSaved) {
    if (!gameData || !manualUnlocksContainer) return;
    const cls = manualClassSelect.value;
    const sub = manualSubclassSelect.value;
    const subPool = gameData.classes[cls].subclasses[sub];
    const savedKit = (preselectSaved && runState.subclassData[sub]) ? runState.subclassData[sub] : getEmptySubclassKit();
    const sections = [
        {key: 'supers', scope: 'sub', title: 'Supers', items: subPool.supers},
        {key: 'classAbilities', scope: 'sub', title: 'Class Abilities', items: subPool.classAbilities},
        {key: 'jumps', scope: 'sub', title: 'Jumps', items: subPool.jumps},
        {key: 'melees', scope: 'sub', title: 'Melees', items: subPool.melees},
        {key: 'grenades', scope: 'sub', title: 'Grenades', items: subPool.grenades},
        {
            key: 'aspects',
            scope: 'sub',
            title: 'Aspects',
            items: subPool.aspects.map(a => typeof a === 'string' ? a : a.name)
        },
        {key: 'fragments', scope: 'sub', title: 'Fragments', items: subPool.fragments},
        {key: 'artifact', scope: 'shared', title: 'Artifact Tiers', items: gameData.shared.artifactTiers},
        {key: 'mods', scope: 'shared', title: 'Armour Mod Slots', items: gameData.shared.armorModSlots},
        {
            key: 'exoticArmour',
            scope: 'shared',
            title: 'Exotic Armour',
            items: gameData.classes[cls].exoticArmor.map(a => typeof a === 'string' ? a : a.name)
        },
        {
            key: 'exoticWeapon',
            scope: 'shared',
            title: 'Exotic Weapons',
            items: gameData.shared.exoticWeapons.map(w => typeof w === 'string' ? w : w.name)
        }
    ];
    manualUnlocksContainer.innerHTML = '';
    sections.forEach(sec => {
        const box = document.createElement('div');
        box.className = 'manual-box';
        const h4 = document.createElement('h4');
        h4.textContent = sec.title;
        box.appendChild(h4);
        const sourceList = sec.scope === 'sub' ? savedKit[sec.key] : (preselectSaved ? runState[sec.key] : []);
        sec.items.forEach(item => {
            const label = document.createElement('label');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = item;
            cb.setAttribute('data-manual-key', sec.key);
            cb.setAttribute('data-manual-scope', sec.scope);
            if (Array.isArray(sourceList) && sourceList.includes(item)) {
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
        clearDraft();
        const cls = manualClassSelect.value;
        const sub = manualSubclassSelect.value;
        const newState = runState.className === cls ? {...runState} : getDefaultRunState();
        newState.className = cls;
        newState.activeSubclass = sub;
        if (!newState.unlockedSubclasses.includes(sub)) {
            newState.unlockedSubclasses.push(sub);
        }
        if (!newState.dungeons || newState.dungeons.length === 0) {
            newState.dungeons = generateDungeonPlaylist();
        }
        const updatedSubKit = getEmptySubclassKit();
        newState.artifact = [];
        newState.mods = [];
        newState.exoticArmour = [];
        newState.exoticWeapon = [];
        manualUnlocksContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            const key = cb.getAttribute('data-manual-key');
            const scope = cb.getAttribute('data-manual-scope');
            if (scope === 'sub' && updatedSubKit[key]) {
                updatedSubKit[key].push(cb.value);
            } else if (scope === 'shared' && newState[key]) {
                newState[key].push(cb.value);
            }
        });
        newState.subclassData[sub] = updatedSubKit;
        runState = newState;
        if (!runState.timerRunning) {
            startRunTimer();
        }
        addHistory("Resume", `Updated / loaded ${cls} (${sub})`, "start");
        updateUI();
        saveToStorage();
        setButtonsDisabled(false);
        if (spinCategory) spinCategory.textContent = "MANUAL BUILD LOADED";
        if (spinResult) spinResult.textContent = `${cls} — ${sub}`;
        if (configPanel) configPanel.classList.add('hidden');
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

// Synergy Calculation & Filtering
function recalculateSynergies() {
    if (!gameData || !runState.className || !runState.activeSubclass) {
        runState.synergies = [];
        return;
    }
    const kit = getActiveKit();
    const tagSet = new Set();
    tagSet.add(runState.activeSubclass);
    (SUBCLASS_ELEMENTS[runState.activeSubclass] || []).forEach(el => tagSet.add(el));
    [
        ...kit.supers,
        ...kit.classAbilities,
        ...kit.jumps,
        ...kit.melees,
        ...kit.grenades,
        ...kit.aspects,
        ...kit.fragments
    ].forEach(ability => tagSet.add(ability));
    const allArmour = gameData.classes[runState.className].exoticArmor;
    runState.exoticArmour.forEach(name => {
        tagSet.add(name);
        const obj = allArmour.find(a => a.name === name);
        if (obj && obj.tags) obj.tags.forEach(t => tagSet.add(t));
    });
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

function getAvailableExoticArmour() {
    if (!gameData || !runState.className) return {items: [], isFallback: false};
    const allUnowned = gameData.classes[runState.className].exoticArmor
        .filter(armour => !runState.exoticArmour.includes(armour.name));
    if (config.enforceSynergy) {
        const synergistic = allUnowned.filter(armour => {
            const isNeutral = armour.subclasses.includes("Any");
            const matchesSub = armour.subclasses.includes(runState.activeSubclass);
            if (!isNeutral && !matchesSub) return false;
            const requirements = (armour.tags || []).filter(t => t.startsWith("Requires:"));
            if (requirements.length > 0) {
                return requirements.some(req => runState.synergies.includes(req.replace("Requires:", "").trim()));
            }
            return true;
        });
        if (synergistic.length > 0) {
            return {items: synergistic.map(a => a.name), isFallback: false};
        }
        if (allUnowned.length > 0) {
            return {items: allUnowned.map(a => a.name), isFallback: true};
        }
    }
    return {items: allUnowned.map(a => a.name), isFallback: false};
}

function getAvailableExoticWeapons() {
    if (!gameData) return {items: [], isFallback: false};
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
            return {items: synergistic.map(w => w.name), isFallback: false};
        }
        if (allUnowned.length > 0) {
            return {items: allUnowned.map(w => w.name), isFallback: true};
        }
    }
    return {items: allUnowned.map(w => w.name), isFallback: false};
}

function setButtonsDisabled(disabled) {
    const hasRun = Boolean(runState.className);
    const draftLocked = pendingDraftChoices.length > 0;
    const availArmour = getAvailableExoticArmour().items.length > 0;
    const availWeapons = getAvailableExoticWeapons().items.length > 0;
    const hasActiveDungeon = runState.dungeons && runState.currentDungeonIndex < runState.dungeons.length;

    if (btnNewRun) btnNewRun.disabled = disabled;
    if (btnSpin) btnSpin.disabled = disabled || !hasRun || draftLocked;
    if (btnExoticAny) btnExoticAny.disabled = disabled || !hasRun || draftLocked || (!availArmour && !availWeapons);
    if (btnExoticArmour) btnExoticArmour.disabled = disabled || !hasRun || draftLocked || !availArmour;
    if (btnExoticWeapon) btnExoticWeapon.disabled = disabled || !hasRun || draftLocked || !availWeapons;

    if (btnToggleTimer) btnToggleTimer.disabled = disabled || !hasRun;
    if (btnFinishEncounter) btnFinishEncounter.disabled = disabled || !hasActiveDungeon;
    if (btnAddDeath) btnAddDeath.disabled = disabled || !hasRun;
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

// Shared Unlock Applicator
function applyUnlockChoice(choice, wasDrafted = false) {
    const {category, subclass, item, isWildcard} = choice;
    const isExotic = category === 'Exotic Armour' || category === 'Exotic Weapon';
    if (category === 'Subclass') {
        runState.unlockedSubclasses.push(item);
        runState.activeSubclass = item;
        runState.subclassData[item] = generateSubclassKit(runState.className, item, config.startFullSubclass);
        const suffix = wasDrafted ? ' (Drafted)' : '';
        addHistory("Subclass", `Unlocked ${item}${suffix}`, "start");
    } else {
        const targetSub = subclass || runState.activeSubclass;
        if (!runState.subclassData[targetSub]) {
            runState.subclassData[targetSub] = getEmptySubclassKit();
        }
        const kit = runState.subclassData[targetSub];
        if (category === 'Super') kit.supers.push(item);
        else if (category === 'Class Ability') kit.classAbilities.push(item);
        else if (category === 'Jump') kit.jumps.push(item);
        else if (category === 'Melee') kit.melees.push(item);
        else if (category === 'Grenade') kit.grenades.push(item);
        else if (category === 'Aspect') kit.aspects.push(item);
        else if (category === 'Fragment') kit.fragments.push(item);
        else if (category === 'Artifact') runState.artifact.push(item);
        else if (category === 'Armour Mod') runState.mods.push(item);
        else if (category === 'Exotic Armour') runState.exoticArmour.push(item);
        else if (category === 'Exotic Weapon') runState.exoticWeapon.push(item);
        const isSubScoped = ['Super', 'Class Ability', 'Jump', 'Melee', 'Grenade', 'Aspect', 'Fragment'].includes(category);
        if (isSubScoped && targetSub) {
            runState.activeSubclass = targetSub;
        }

        const scopePrefix = isSubScoped && targetSub ? `[${targetSub}] ` : '';
        const suffix = wasDrafted ? ' (Drafted)' : '';
        const badgeLabel = isWildcard ? `${category} • Wildcard` : category;
        const badgeStyle = isWildcard ? 'wildcard' : (isExotic ? 'exotic' : '');

        addHistory(badgeLabel, `${scopePrefix}Unlocked ${item}${suffix}`, badgeStyle);
    }
    updateUI();
}

function showDraftChoices(choices) {
    pendingDraftChoices = choices;
    if (!draftContainer || !draftCards) return;
    draftCards.innerHTML = '';
    choices.forEach(choice => {
        const isExotic = choice.category === 'Exotic Armour' || choice.category === 'Exotic Weapon';
        const isPrismatic = (choice.category === 'Subclass' && choice.item === 'Prismatic') || choice.subclass === 'Prismatic';
        const isSubScoped = ['Super', 'Class Ability', 'Jump', 'Melee', 'Grenade', 'Aspect', 'Fragment'].includes(choice.category);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'draft-card';
        if (isExotic) card.classList.add('exotic');
        if (isPrismatic) card.classList.add('prismatic');
        const subTag = isSubScoped && choice.subclass ? `• ${choice.subclass}` : '';
        const catText = choice.isWildcard ? `${choice.category}${subTag} • Wildcard` : `${choice.category}${subTag}`;
        card.innerHTML = `<span class="draft-card-cat">${catText}</span> <span class="draft-card-name">${choice.item}</span> <span class="draft-card-cta">Click to Select ➔</span>`;
        card.addEventListener('click', () => {
            if (isSpinning) return;
            clearDraft();
            const displayLabel = isSubScoped && choice.subclass ? `[${choice.subclass}] ${choice.item}` : choice.item;
            if (spinCategory) spinCategory.textContent = `DRAFTED: ${choice.category.toUpperCase()}`;
            if (spinResult) spinResult.textContent = displayLabel;
            if (spinDisplay) spinDisplay.className = `spinner-box ${isExotic ? 'exotic-win' : (isPrismatic ? 'prismatic-win' : '')}`;
            applyUnlockChoice(choice, true);
            saveToStorage();
            setButtonsDisabled(false);
        });
        draftCards.appendChild(card);
    });
    draftContainer.classList.remove('hidden');
    setButtonsDisabled(false);
}

// Build Candidate Pools Across ALL Unlocked Subclasses
function getStandardSpinPools() {
    const allClassSubclasses = Object.keys(gameData.classes[runState.className].subclasses);
    const pools = {
        'Subclass': allClassSubclasses
            .filter(s => !runState.unlockedSubclasses.includes(s))
            .map(s => ({subclass: s, item: s})),
        'Super': [],
        'Class Ability': [],
        'Jump': [],
        'Melee': [],
        'Grenade': [],
        'Aspect': [],
        'Fragment': [],
        'Artifact': gameData.shared.artifactTiers
            .filter(t => !runState.artifact.includes(t))
            .map(t => ({subclass: null, item: t})),
        'Armour Mod': gameData.shared.armorModSlots
            .filter(m => !runState.mods.includes(m))
            .map(m => ({subclass: null, item: m}))
    };
    runState.unlockedSubclasses.forEach(sub => {
        const kit = runState.subclassData[sub] || getEmptySubclassKit();
        const subPool = gameData.classes[runState.className].subclasses[sub];
        const aspectNames = subPool.aspects.map(a => typeof a === 'string' ? a : a.name);
        subPool.supers.filter(s => !kit.supers.includes(s))
            .forEach(s => pools['Super'].push({subclass: sub, item: s}));
        subPool.classAbilities.filter(c => !kit.classAbilities.includes(c))
            .forEach(c => pools['Class Ability'].push({subclass: sub, item: c}));
        subPool.jumps.filter(j => !kit.jumps.includes(j))
            .forEach(j => pools['Jump'].push({subclass: sub, item: j}));
        subPool.melees.filter(m => !kit.melees.includes(m))
            .forEach(m => pools['Melee'].push({subclass: sub, item: m}));
        subPool.grenades.filter(g => !kit.grenades.includes(g))
            .forEach(g => pools['Grenade'].push({subclass: sub, item: g}));
        aspectNames.filter(a => !kit.aspects.includes(a))
            .forEach(a => pools['Aspect'].push({subclass: sub, item: a}));
        if (kit.aspects.length > 0) {
            subPool.fragments.filter(f => !kit.fragments.includes(f))
                .forEach(f => pools['Fragment'].push({subclass: sub, item: f}));
        }
    });
    const eligibleCategories = [];
    Object.keys(pools).forEach(cat => {
        if (config.enabledCategories[cat] && pools[cat].length > 0) {
            eligibleCategories.push(cat);
        }
    });
    const fallbackFlags = {'Exotic Armour': false, 'Exotic Weapon': false};
    if (config.includeExoticsInStandard) {
        const armourData = getAvailableExoticArmour();
        const weaponData = getAvailableExoticWeapons();
        if (armourData.items.length > 0) {
            pools['Exotic Armour'] = armourData.items.map(item => ({subclass: null, item}));
            fallbackFlags['Exotic Armour'] = armourData.isFallback;
            eligibleCategories.push('Exotic Armour');
        }
        if (weaponData.items.length > 0) {
            pools['Exotic Weapon'] = weaponData.items.map(item => ({subclass: null, item}));
            fallbackFlags['Exotic Weapon'] = weaponData.isFallback;
            eligibleCategories.push('Exotic Weapon');
        }
    }
    return {pools, eligibleCategories, fallbackFlags};
}

function rollStandardDraft(count = 3) {
    const {pools, eligibleCategories, fallbackFlags} = getStandardSpinPools();
    if (eligibleCategories.length === 0) return [];
    const workingPools = {};
    eligibleCategories.forEach(cat => {
        workingPools[cat] = [...pools[cat]];
    });
    const choices = [];
    const usedCategories = new Set();
    for (let i = 0; i < count; i++) {
        const nonEmptyCats = eligibleCategories.filter(cat => workingPools[cat].length > 0);
        if (nonEmptyCats.length === 0) break;
        const distinctCats = nonEmptyCats.filter(cat => !usedCategories.has(cat));
        const catPool = distinctCats.length > 0 ? distinctCats : nonEmptyCats;
        const chosenCat = getRandomItem(catPool);
        usedCategories.add(chosenCat);
        const itemIndex = Math.floor(Math.random() * workingPools[chosenCat].length);
        const chosenEntry = workingPools[chosenCat].splice(itemIndex, 1)[0];
        choices.push({
            category: chosenCat,
            subclass: chosenEntry.subclass,
            item: chosenEntry.item,
            isWildcard: Boolean(fallbackFlags[chosenCat])
        });
    }
    return choices;
}

// 1. Start New Run
if (btnNewRun) {
    btnNewRun.addEventListener('click', () => {
        if (!gameData || isSpinning) return;
        clearDraft();
        const classes = Object.keys(gameData.classes);
        const chosenClass = getRandomItem(classes);
        const subclasses = Object.keys(gameData.classes[chosenClass].subclasses);
        const chosenSubclass = getRandomItem(subclasses);
        const previewPool = [];
        classes.forEach(c => {
            Object.keys(gameData.classes[c].subclasses).forEach(sub => {
                previewPool.push(`${c} — ${sub}`);
            });
        });
        const finalLabel = `${chosenClass} — ${chosenSubclass}`;
        const winStyle = chosenSubclass === 'Prismatic' ? 'prismatic-win' : '';
        animateSpin("ROLLING STARTING GUARDIAN...", previewPool, finalLabel, winStyle, () => {
            const freshState = getDefaultRunState();
            freshState.className = chosenClass;
            freshState.activeSubclass = chosenSubclass;
            freshState.unlockedSubclasses = [chosenSubclass];
            freshState.subclassData[chosenSubclass] = generateSubclassKit(chosenClass, chosenSubclass, config.startFullSubclass);
            if (config.enableDungeonGauntlet) {
                freshState.dungeons = generateDungeonPlaylist();
            }
            runState = freshState;

            if (config.enableDungeonGauntlet) {
                startRunTimer();
            }
            const kit = getActiveKit();
            if (spinCategory) spinCategory.textContent = "STARTING RUN STATE";
            const startSummary = config.startFullSubclass
                ? `${chosenClass} (${chosenSubclass}) — Full Subclass (${kit.aspects.length} Aspects, ${kit.fragments.length} Fragments)`
                : `${chosenClass} (${chosenSubclass}) — Basic kit rolled`;
            addHistory("Start", `${startSummary} | ${runState.dungeons.length} Dungeons queued`, "start");
            updateUI();
        });
    });
}
// 2. Standard Spin
if (btnSpin) {
    btnSpin.addEventListener('click', () => {
        if (isSpinning || !runState.className || pendingDraftChoices.length > 0) return;
        const {pools, eligibleCategories, fallbackFlags} = getStandardSpinPools();
        if (eligibleCategories.length === 0) {
            if (spinCategory) spinCategory.textContent = "NO ELIGIBLE ITEMS";
            if (spinResult) spinResult.textContent = "All enabled categories across your unlocked subclasses are unlocked!";
            return;
        }
        if (config.rogueliteMode) {
            const choices = rollStandardDraft(3);
            const previewItems = choices.map(c => c.item);
            const visualPool = previewItems.length > 1 ? [...previewItems, "Scanning Subclasses...", "Decrypting Engram..."] : [previewItems[0], "Rolling Draft..."];
            animateSpin("ROGUELITE DRAFT", visualPool, `Drafted ${choices.length} Options — Pick One Below!`, '', () => {
                showDraftChoices(choices);
            });
            return;
        }
        const chosenCategory = getRandomItem(eligibleCategories);
        const targetPool = pools[chosenCategory];
        const chosenEntry = getRandomItem(targetPool);
        const unlockedItem = chosenEntry.item;
        const isSubScoped = ['Super', 'Class Ability', 'Jump', 'Melee', 'Grenade', 'Aspect', 'Fragment'].includes(chosenCategory);
        const displayResult = isSubScoped && chosenEntry.subclass ? `[${chosenEntry.subclass}] ${unlockedItem}` : unlockedItem;
        const previewNames = targetPool.map(e => e.item);
        const visualPool = previewNames.length > 1 ? previewNames : [unlockedItem, "Decrypting Engram...", "Scanning Subclasses..."];
        const isExotic = chosenCategory === 'Exotic Armour' || chosenCategory === 'Exotic Weapon';
        const isWildcard = Boolean(fallbackFlags[chosenCategory]);
        const bannerTitle = isWildcard
            ? `CATEGORY: ${chosenCategory.toUpperCase()} (WILDCARD FALLBACK)`
            : `CATEGORY: ${chosenCategory.toUpperCase()}`;
        const winStyle = isExotic ? 'exotic-win' : ((chosenCategory === 'Subclass' && unlockedItem === 'Prismatic') || chosenEntry.subclass === 'Prismatic' ? 'prismatic-win' : '');
        animateSpin(bannerTitle, visualPool, `Unlocked: ${displayResult}`, winStyle, () => {
            applyUnlockChoice({
                category: chosenCategory,
                subclass: chosenEntry.subclass,
                item: unlockedItem,
                isWildcard
            }, false);
        });
    });
}

// 3. Dedicated Exotic Spin Handlers
function handleExoticSpin(mode) {
    if (isSpinning || !runState.className || pendingDraftChoices.length > 0) return;
    const armourData = getAvailableExoticArmour();
    const weaponData = getAvailableExoticWeapons();
    if (config.rogueliteMode) {
        const candidates = [];
        if (mode === 'armour' || mode === 'any') {
            armourData.items.forEach(item => candidates.push({
                category: 'Exotic Armour',
                subclass: null,
                item,
                isWildcard: armourData.isFallback
            }));
        }
        if (mode === 'weapon' || mode === 'any') {
            weaponData.items.forEach(item => candidates.push({
                category: 'Exotic Weapon',
                subclass: null,
                item,
                isWildcard: weaponData.isFallback
            }));
        }
        if (candidates.length === 0) return;
        const choices = getRandomItems(candidates, 3);
        const visualPool = choices.length > 1 ? choices.map(c => c.item) : [choices[0].item, "Decrypting Exotic Engram..."];
        animateSpin("ROGUELITE EXOTIC DRAFT", visualPool, `Drafted ${choices.length} Exotics — Pick One Below!`, 'exotic-win', () => {
            showDraftChoices(choices);
        });
        return;
    }
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
            applyUnlockChoice({
                category: 'Exotic Armour',
                subclass: null,
                item: chosen,
                isWildcard: armourData.isFallback
            }, false);
        });
    } else if (rollType === 'weapon' && weaponData.items.length > 0) {
        const chosen = getRandomItem(weaponData.items);
        const visualPool = weaponData.items.length > 1 ? weaponData.items : [chosen, "Decrypting Exotic Engram..."];
        const label = weaponData.isFallback
            ? "EXOTIC WEAPON (WILDCARD FALLBACK)"
            : "EXOTIC WEAPON";
        animateSpin(label, visualPool, chosen, 'exotic-win', () => {
            applyUnlockChoice({
                category: 'Exotic Weapon',
                subclass: null,
                item: chosen,
                isWildcard: weaponData.isFallback
            }, false);
        });
    }
}

if (btnExoticAny) btnExoticAny.addEventListener('click', () => handleExoticSpin('any'));
if (btnExoticArmour) btnExoticArmour.addEventListener('click', () => handleExoticSpin('armour'));
if (btnExoticWeapon) btnExoticWeapon.addEventListener('click', () => handleExoticSpin('weapon'));

// Render Dungeon Gauntlet Progress
function renderDungeons() {
    const statDungeons = document.getElementById('stat-dungeons');
    const statEncounters = document.getElementById('stat-encounters');
    const statDeaths = document.getElementById('stat-deaths');
    const currentNameEl = document.getElementById('current-dungeon-name');
    const playlistEl = document.getElementById('dungeon-playlist');

    const dungeons = runState.dungeons || [];
    const completedCount = dungeons.filter(d => d.completed).length;

    updateTimerDisplay();
    if (statDungeons) statDungeons.textContent = `${completedCount} / ${dungeons.length}`;
    if (statEncounters) statEncounters.textContent = runState.encountersCleared || 0;
    if (statDeaths) statDeaths.textContent = runState.deaths || 0;

    if (currentNameEl) {
        if (dungeons.length === 0) {
            currentNameEl.textContent = "Start a run to generate dungeon list";
        } else if (runState.currentDungeonIndex < dungeons.length) {
            const cur = dungeons[runState.currentDungeonIndex];
            const total = cur.encountersTotal || 3;
            currentNameEl.textContent = `${cur.name} (Encounter ${cur.encountersDone + 1} / ${total})`;
        } else {
            currentNameEl.textContent = `🏆 Gauntlet Complete! (${formatDuration(runState.elapsedSeconds || 0)})`;
        }
    }

    if (!playlistEl) return;
    playlistEl.innerHTML = '';

    if (dungeons.length === 0) {
        playlistEl.innerHTML = '<li class="muted">No dungeons queued yet.</li>';
        return;
    }

    dungeons.forEach((d, idx) => {
        const li = document.createElement('li');
        const isActive = idx === runState.currentDungeonIndex && !d.completed;
        if (d.completed) li.classList.add('completed-dungeon');
        if (isActive) li.classList.add('active-dungeon');

        const total = d.encountersTotal || 3;
        const statusIcon = d.completed ? '✓' : (isActive ? '▶' : `${idx + 1}.`);
        const rightMeta = d.completed && d.completedAt
            ? `Cleared @ ${d.completedAt}`
            : `${d.encountersDone} / ${total} Encounters`;
        li.innerHTML = `
      <span>${statusIcon} ${d.name}</span>
      <span style="font-size:0.8rem; color:var(--muted);">${rightMeta}</span>
    `;
        playlistEl.appendChild(li);
    });
}

// Render Clickable Subclass Tabs
function renderSubclassTabs() {
    const container = document.getElementById('subclass-tabs');
    const activeLabel = document.getElementById('active-sub-label');
    if (!container) return;
    if (activeLabel) activeLabel.textContent = runState.activeSubclass || '—';
    container.innerHTML = '';
    if (!runState.unlockedSubclasses || runState.unlockedSubclasses.length === 0) {
        container.innerHTML = 'Not rolled';
        return;
    }
    runState.unlockedSubclasses.forEach(sub => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sub-tab';
        if (sub === 'Prismatic') btn.classList.add('prismatic');
        if (sub === runState.activeSubclass) btn.classList.add('active');
        btn.textContent = sub;
        btn.addEventListener('click', () => {
            if (isSpinning || runState.activeSubclass === sub || pendingDraftChoices.length > 0) return;
            runState.activeSubclass = sub;
            saveToStorage();
            updateUI();
            setButtonsDisabled(false);
        });
        container.appendChild(btn);
    });
}

// Update the HTML display
function updateUI() {
    recalculateSynergies();
    const elClass = document.getElementById('state-class');
    if (elClass) elClass.textContent = runState.className || 'Not rolled';
    renderDungeons();
    renderSubclassTabs();
    const kit = getActiveKit();
    renderList('list-supers', kit.supers, 'Not rolled');
    renderList('list-class-abilities', kit.classAbilities, 'None');
    renderList('list-jumps', kit.jumps, 'None');
    renderList('list-melees', kit.melees, 'None');
    renderList('list-grenades', kit.grenades, 'None');
    renderList('list-aspects', kit.aspects, 'None unlocked');
    const fragEmptyText = kit.aspects.length === 0
        ? 'Locked (Requires 1 Aspect)'
        : 'None unlocked';
    renderList('list-fragments', kit.fragments, fragEmptyText);
    renderList('list-exotic-armour', runState.exoticArmour, 'None unlocked', true);
    renderList('list-exotic-weapon', runState.exoticWeapon, 'None unlocked', true);
    renderList('list-artifact', runState.artifact, 'None unlocked');
    renderList('list-mods', runState.mods, 'None unlocked');
    renderSynergies();
}

function renderList(elementId, items, emptyMessage, isExotic = false) {
    const ul = document.getElementById(elementId);
    if (!ul) return;
    ul.innerHTML = '';
    if (!items || items.length === 0) {
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

function renderSynergies() {
    const container = document.getElementById('list-synergies');
    const countEl = document.getElementById('synergy-count');
    if (!container) return;
    if (countEl) countEl.textContent = runState.synergies.length;
    container.innerHTML = '';
    if (runState.synergies.length === 0) {
        container.innerHTML = 'No synergies active yet.';
        return;
    }
    runState.synergies.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'synergy-pill';
        span.textContent = tag;
        container.appendChild(span);
    });
}

function renderHistory() {
    const ul = document.getElementById('history-list');
    if (!ul) return;
    ul.innerHTML = '';
    if (!runState.history || runState.history.length === 0) {
        ul.innerHTML = 'No actions recorded yet.';
        return;
    }
    runState.history.forEach(entry => {
        const li = document.createElement('li');
        li.innerHTML = `<span><strong>#${entry.step}</strong> &nbsp;${entry.text}</span> <span class="badge ${entry.type}">${entry.badge}</span>`;
        ul.appendChild(li);
    });
}

function applyDungeonVisibility() {
    const isEnabled = Boolean(config.enableDungeonGauntlet);
    if (dungeonCard) {
        dungeonCard.classList.toggle('hidden', !isEnabled);
    }
    if (dungeonSettingsControls) {
        dungeonSettingsControls.style.opacity = isEnabled ? '1' : '0.45';
        dungeonSettingsControls.style.pointerEvents = isEnabled ? 'auto' : 'none';
    }
}