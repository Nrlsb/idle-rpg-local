import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// --- Constantes del Juego ---
const ITEM_RARITIES = {
    common: { name: 'Común', color: 'text-gray-300', multiplier: 1, dismantle: { scrap: 1 }, sellValue: 5 },
    rare: { name: 'Raro', color: 'text-blue-400', multiplier: 1.5, dismantle: { scrap: 3, essence: 1 }, sellValue: 20 },
    epic: { name: 'Épico', color: 'text-purple-500', multiplier: 2.5, dismantle: { scrap: 5, essence: 3 }, sellValue: 100 },
};

const ITEM_TEMPLATES = {
    weapon: { name: 'Espada', icon: '⚔️', stat: 'damage', baseValue: 2 },
    shield: { name: 'Escudo', icon: '🛡️', stat: 'maxHp', baseValue: 10 },
    amulet: { name: 'Amuleto', icon: '💎', stat: 'critChance', baseValue: 0.01 },
};

const MATERIALS = {
    scrap: { name: 'Fragmentos de Chatarra', icon: '⚙️' },
    essence: { name: 'Esencia Mágica', icon: '✨' },
};

const PETS = {
    wolf: { id: 'wolf', name: 'Lobo Fiel', icon: '🐺', bonusStat: 'damage', bonusPerLevel: 0.05, description: '+5% de Daño por nivel' },
    golem: { id: 'golem', name: 'Gólem de Oro', icon: '🗿', bonusStat: 'gold', bonusPerLevel: 0.03, description: '+3% de Oro por nivel' },
    sprite: { id: 'sprite', name: 'Hada de la Suerte', icon: '🧚', bonusStat: 'critChance', bonusPerLevel: 0.005, description: '+0.5% Prob. Crítico por nivel' },
};

// NUEVO: Habilidades de Monstruos
const MONSTER_ABILITIES = {
    heal: {
        name: 'Curación Menor',
        description: 'Se cura un 5% de su vida máxima cuando está por debajo del 50% de HP (una vez por combate).',
        color: 'text-green-400',
        trigger: 'onDamage',
        effect: (monster, hero, gameState, addLogMessage, createFloatingText) => {
            if (!monster.usedHeal && monster.hp < monster.maxHp / 2) {
                const healAmount = Math.round(monster.maxHp * 0.05);
                monster.hp = Math.min(monster.maxHp, monster.hp + healAmount);
                monster.usedHeal = true;
                addLogMessage(`${monster.name} usa Curación Menor y recupera ${healAmount} HP.`, 'text-green-400');
                createFloatingText(`+${healAmount} HP`, 'lightgreen');
            }
            return { monster, hero };
        }
    },
    dodge: {
        name: 'Evasión',
        description: 'Tiene un 15% de probabilidad de esquivar un ataque.',
        color: 'text-cyan-400',
        trigger: 'beforeDamage',
        effect: (monster, hero, gameState, addLogMessage, createFloatingText, damageDealt) => {
            if (Math.random() < 0.15) {
                addLogMessage(`${monster.name} esquiva el ataque!`, 'text-cyan-400');
                createFloatingText('Esquiva!', 'cyan');
                return { monster, hero, damageDealt: 0 }; // Anula el daño
            }
            return { monster, hero, damageDealt };
        }
    },
    poison: {
        name: 'Ataque Venenoso',
        description: 'Tiene un 25% de probabilidad de envenenar al héroe, infligiendo un 2% de la vida máxima del héroe como daño durante 5 segundos.',
        color: 'text-purple-400',
        trigger: 'onMonsterAttack',
        effect: (monster, hero, gameState, addLogMessage, createFloatingText) => {
            if (Math.random() < 0.25 && !hero.effects.poisoned) {
                addLogMessage(`${monster.name} envenena al héroe!`, 'text-purple-400');
                createFloatingText('Venenoso!', 'purple');
                hero.effects.poisoned = {
                    duration: 5,
                    damage: hero.maxHp * 0.02
                };
            }
            return { monster, hero };
        }
    }
};


// --- Estado Inicial del Juego ---
const initialHeroState = {
    level: 1,
    hp: 100,
    maxHp: 100,
    damage: 10,
    critChance: 0.05,
    critMultiplier: 1.5,
    gold: 0,
    xp: 0,
    xpNeeded: 100,
    skillPoints: 0,
    materials: {
        scrap: 0,
        essence: 0,
    },
    equipment: {
        weapon: null,
        shield: null,
        amulet: null,
    },
    effects: { // Efectos sobre el héroe
        poisoned: null, // { duration: 5, damage: 2 }
    },
};

const initialGameState = {
    hero: { ...initialHeroState },
    inventory: [],
    monster: {
        name: "Orco Débil",
        hp: 50,
        maxHp: 50,
        goldReward: 5,
        xpReward: 10,
        art: '👹',
        abilities: [], // NUEVO: Habilidades del monstruo
        usedHeal: false, // NUEVO: Para la habilidad de curación
    },
    upgrades: {
        damage: { cost: 10, increase: 1, level: 0 },
        health: { cost: 15, increase: 10, level: 0 },
        critChance: { cost: 50, increase: 0.01, level: 0 },
    },
    skills: {
        powerfulStrike: { name: 'Golpe Poderoso', cooldown: 10, remaining: 0, description: 'Inflige 300% de daño.' },
        quickHeal: { name: 'Curación Rápida', cooldown: 30, remaining: 0, description: 'Cura 25% de la vida máxima.' },
        goldRush: { name: 'Lluvia de Oro', cooldown: 60, remaining: 0, description: 'Duplica el oro del próximo monstruo.' },
    },
    passiveSkills: {
        increasedDamage: { name: 'Fuerza Bruta', level: 0, cost: 1, increase: 0.02, description: '+2% Daño por nivel' },
        increasedHealth: { name: 'Vitalidad', level: 0, cost: 1, increase: 0.03, description: '+3% Vida Máxima por nivel' },
        fasterCooldowns: { name: 'Presteza', level: 0, cost: 2, increase: 0.01, description: '-1% Enfriamiento de Habilidades por nivel' }
    },
    pets: {
        owned: ['wolf'],
        activePetId: 'wolf',
        levels: {
            wolf: 1,
            golem: 0,
            sprite: 0,
        }
    },
    effects: {
        powerfulStrikeActive: false,
        goldRushActive: false,
    },
    stage: 1,
    monstersKilledInStage: 0,
    monstersPerStage: 10,
    monsterArt: ['👹', '👺', '👻', '👽', '💀', '🤖', '🎃', '🐲', '🦂', '🦇'],
    bossArt: ['😈', '🤡', '👹', '🧛', '🧟', '🧞', '🦍', '🐊', '🦖', '🐙'],
    combatLog: [],
    floatingTexts: [],
    toasts: [],
    isBossFight: false,
    bossTimer: 30,
    prestige: {
        level: 0,
        relics: 0,
        nextLevelReq: 50,
    },
    prestigeUpgrades: {
        goldBonus: { name: 'Bendición Dorada', level: 0, cost: 1, increase: 0.1, description: '+10% Oro por nivel' },
        damageBonus: { name: 'Fuerza Ancestral', level: 0, cost: 1, increase: 0.05, description: '+5% Daño por nivel' },
    },
    monsterAnimation: '',
    lastDailyReward: null,
    settings: {
        musicOn: true,
        sfxOn: true,
    },
};

// --- COMPONENTES DE UI ---

const Toast = ({ message, type, onDismiss }) => {
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setExiting(true);
            setTimeout(onDismiss, 500);
        }, 5000);

        return () => clearTimeout(timer);
    }, [onDismiss]);

    const handleDismiss = () => {
        setExiting(true);
        setTimeout(onDismiss, 500);
    };

    const typeStyles = {
        info: 'bg-blue-500 border-blue-400',
        success: 'bg-green-500 border-green-400',
        warning: 'bg-yellow-500 border-yellow-400',
        prestige: 'bg-purple-600 border-purple-500',
        'loot-raro': 'bg-blue-600 border-blue-400',
        'loot-épico': 'bg-purple-700 border-purple-500',
    };

    return (
        <div className={`relative p-4 rounded-lg shadow-lg text-white mb-2 border-l-4 ${typeStyles[type] || typeStyles.info} ${exiting ? 'animate-toast-out' : 'animate-toast-in'}`}>
            {message}
            <button onClick={handleDismiss} className="absolute top-1 right-2 text-white font-bold">&times;</button>
        </div>
    );
};

const ToastContainer = ({ toasts, onDismiss }) => (
    <div className="fixed top-4 right-4 z-50 w-80">
        {toasts.map(toast => (
            <Toast key={toast.id} {...toast} onDismiss={() => onDismiss(toast.id)} />
        ))}
    </div>
);


const HeroPanel = ({ hero, stats, prestige, activePet }) => {
    const xpPercentage = (hero.xp / hero.xpNeeded) * 100;
    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-2 text-center border-b border-gray-700 pb-2">Héroe</h2>
            {activePet && <p className="text-center text-lg">{activePet.icon} {activePet.name} <span className="text-yellow-400">Nvl. {hero.petLevel}</span></p>}
            {prestige.level > 0 && <p className="text-center text-yellow-400 font-bold">Prestigio: {prestige.level}</p>}
            <div className="space-y-3 text-lg mt-2">
                <p><strong>Nivel:</strong> {hero.level}</p>
                <p><strong>Puntos de Habilidad:</strong> <span className="text-green-400 font-bold">{hero.skillPoints}</span></p>
                <p><strong>HP:</strong> {Math.round(hero.hp)} / {stats.maxHp} {hero.effects.poisoned && <span className="text-purple-400">(Envenenado)</span>}</p>
                <p><strong>Daño:</strong> {stats.damage.toFixed(1)}</p>
                <p><strong>Prob. Crítico:</strong> {(stats.critChance * 100).toFixed(2)}%</p>
                <p><strong>Oro:</strong> {hero.gold}</p>
                <div>
                    <strong>XP:</strong>
                    <div className="w-full bg-gray-700 rounded-full h-4 mt-1">
                        <div className="bg-blue-500 h-4 rounded-full transition-all duration-300" style={{ width: `${xpPercentage}%` }}></div>
                    </div>
                    <p className="text-sm text-center mt-1">{hero.xp} / {hero.xpNeeded}</p>
                </div>
            </div>
        </div>
    );
};

const CombatPanel = ({ monster, stage, combatLog, isBossFight, bossTimer, monsterAnimation }) => {
    const hpPercentage = (monster.hp / monster.maxHp) * 100;
    const logRef = useRef(null);

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [combatLog]);

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col items-center justify-between h-full">
            <div>
                <h2 className={`text-2xl font-bold text-center ${isBossFight ? 'text-yellow-400 animate-pulse' : 'text-red-400'}`}>{monster.name}</h2>
                <div className="text-center my-2 h-6">
                    {monster.abilities.map(abilityId => {
                        const ability = MONSTER_ABILITIES[abilityId];
                        return <span key={abilityId} className={`text-xs font-bold px-2 py-1 rounded-full mr-1 ${ability.color}`}>{ability.name}</span>
                    })}
                </div>
                <div id="monster-art-container" className={`text-6xl text-center my-4 relative ${isBossFight ? 'transform scale-125' : ''} ${monsterAnimation}`}>{monster.art}</div>
                <div className="relative">
                    <div className="w-full bg-gray-700 rounded-full h-6">
                        <div className={`${isBossFight ? 'bg-yellow-500' : 'bg-red-600'} h-6 rounded-full transition-all duration-300`} style={{ width: `${hpPercentage}%` }}></div>
                    </div>
                    <p className="absolute inset-0 flex items-center justify-center font-bold">
                        {Math.round(monster.hp)} / {monster.maxHp}
                    </p>
                </div>
                {isBossFight ? (
                    <p className="text-center mt-2 text-2xl font-bold text-red-500">Tiempo: {bossTimer}</p>
                ) : (
                    <p className="text-center mt-2"><strong>Etapa:</strong> {stage}</p>
                )}
            </div>
            <div ref={logRef} className="w-full h-48 bg-gray-900 rounded-lg mt-4 p-2 overflow-y-auto text-sm">
                {combatLog.map((msg, index) => (
                    <p key={index} className={msg.color}>{msg.text}</p>
                ))}
            </div>
        </div>
    );
};

const UpgradeButton = ({ onClick, disabled, children }) => (
    <button onClick={onClick} disabled={disabled} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed">
        {children}
    </button>
);

const UpgradesPanel = ({ gold, upgrades, onUpgrade }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Mejoras de Oro</h2>
        <div className="space-y-4">
            <UpgradeButton onClick={() => onUpgrade('damage')} disabled={gold < upgrades.damage.cost}>
                Aumentar Daño (+{upgrades.damage.increase})
                <br />
                <span className="text-sm font-normal">Costo: {upgrades.damage.cost} Oro</span>
            </UpgradeButton>
            <UpgradeButton onClick={() => onUpgrade('health')} disabled={gold < upgrades.health.cost}>
                Aumentar Salud (+{upgrades.health.increase})
                <br />
                <span className="text-sm font-normal">Costo: {upgrades.health.cost} Oro</span>
            </UpgradeButton>
            <UpgradeButton onClick={() => onUpgrade('critChance')} disabled={gold < upgrades.critChance.cost}>
                Prob. Crítico (+1%)
                <br />
                <span className="text-sm font-normal">Costo: {upgrades.critChance.cost} Oro</span>
            </UpgradeButton>
        </div>
    </div>
);

const SkillButton = ({ skill, onClick }) => {
    const onCooldown = skill.remaining > 0;
    const cooldownPercentage = (skill.cooldown - skill.remaining) / skill.cooldown * 100;

    return (
        <button
            onClick={onClick}
            disabled={onCooldown}
            className="relative w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed overflow-hidden"
        >
            {onCooldown && (
                <div
                    className="absolute top-0 left-0 h-full bg-purple-900 opacity-75"
                    style={{ width: `${cooldownPercentage}%` }}
                ></div>
            )}
            <span className="relative z-10">
                {skill.name}
                <br />
                <span className="text-sm font-normal">{onCooldown ? `${Number(skill.remaining).toFixed(1)}s` : skill.description}</span>
            </span>
        </button>
    );
};

const SkillsPanel = ({ skills, onUseSkill }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Habilidades</h2>
        <div className="space-y-4">
            <SkillButton skill={skills.powerfulStrike} onClick={() => onUseSkill('powerfulStrike')} />
            <SkillButton skill={skills.quickHeal} onClick={() => onUseSkill('quickHeal')} />
            <SkillButton skill={skills.goldRush} onClick={() => onUseSkill('goldRush')} />
        </div>
    </div>
);

const ItemCard = ({ item, onEquip, onUnequip, onDismantle, onSell }) => {
    if (!item) {
        return <div className="bg-gray-700 p-2 rounded-lg text-center text-gray-400 h-full flex items-center justify-center">Vacío</div>;
    }
    const rarity = ITEM_RARITIES[item.rarity];
    return (
        <div className={`bg-gray-700 p-2 rounded-lg border ${rarity.color.replace('text-', 'border-').slice(0, -4)}-500 flex flex-col justify-between`}>
            <div>
                <p className={`font-bold ${rarity.color}`}>{item.icon} {item.name} {item.upgradeLevel > 0 && `+${item.upgradeLevel}`}</p>
                <p className="text-sm">+ {item.stat === 'critChance' ? (item.value * 100).toFixed(1) + '%' : item.value.toFixed(0)} {item.stat === 'maxHp' ? 'HP' : item.stat === 'damage' ? 'Daño' : 'Crit'}</p>
            </div>
            <div className="grid grid-cols-2 gap-1 mt-2">
                {onEquip && <button onClick={onEquip} className="w-full bg-blue-600 hover:bg-blue-700 text-xs py-1 rounded">Equipar</button>}
                {onUnequip && <button onClick={onUnequip} className="w-full bg-gray-600 hover:bg-gray-700 text-xs py-1 rounded col-span-2">Quitar</button>}
                {onSell && <button onClick={onSell} className="w-full bg-green-600 hover:bg-green-700 text-xs py-1 rounded">Vender</button>}
                {onDismantle && <button onClick={onDismantle} className="w-full bg-red-600 hover:bg-red-700 text-xs py-1 rounded">Desmant.</button>}
            </div>
        </div>
    );
};

const InventoryPanel = ({ equipment, inventory, onEquip, onUnequip, onDismantle, onSell }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg h-full">
        <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Equipamiento</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
            <ItemCard item={equipment.weapon} onUnequip={equipment.weapon ? () => onUnequip('weapon') : null} />
            <ItemCard item={equipment.shield} onUnequip={equipment.shield ? () => onUnequip('shield') : null} />
            <ItemCard item={equipment.amulet} onUnequip={equipment.amulet ? () => onUnequip('amulet') : null} />
        </div>
        <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Inventario ({inventory.length})</h2>
        <div className="grid grid-cols-4 gap-2 h-48 overflow-y-auto">
            {inventory.map(item => (
                <ItemCard key={item.id} item={item} onEquip={() => onEquip(item.id)} onDismantle={() => onDismantle(item.id)} onSell={() => onSell(item.id)} />
            ))}
        </div>
    </div>
);

const PrestigePanel = ({ hero, prestige, onPrestige }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Prestigio</h2>
        <p className="text-center">Reliquias: <span className="font-bold text-yellow-300">{prestige.relics}</span></p>
        <p className="text-center text-sm mb-4">Nivel Requerido: {prestige.nextLevelReq}</p>
        <button
            onClick={onPrestige}
            disabled={hero.level < prestige.nextLevelReq}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
            Renacer
        </button>
    </div>
);

const PrestigeUpgradesPanel = ({ relics, upgrades, onUpgrade }) => (
     <div className="bg-gray-800 p-6 rounded-lg shadow-lg h-full">
        <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Mejoras de Reliquia</h2>
        <div className="space-y-4">
            {Object.entries(upgrades).map(([key, upgrade]) => (
                 <button
                    key={key}
                    onClick={() => onUpgrade(key)}
                    disabled={relics < upgrade.cost}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
                 >
                     {upgrade.name} (Nvl {upgrade.level})
                     <br />
                     <span className="text-sm font-normal">{upgrade.description}</span>
                     <br/>
                     <span className="text-sm font-normal">Costo: {upgrade.cost} Reliquias</span>
                 </button>
            ))}
        </div>
    </div>
);

const PassiveSkillsPanel = ({ skillPoints, skills, onUpgrade }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg h-full">
        <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Habilidades Pasivas</h2>
        <div className="space-y-4">
            {Object.entries(skills).map(([key, skill]) => (
                <button
                    key={key}
                    onClick={() => onUpgrade(key)}
                    disabled={skillPoints < skill.cost}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                    {skill.name} (Nvl {skill.level})
                    <br />
                    <span className="text-sm font-normal">{skill.description}</span>
                    <br />
                    <span className="text-sm font-normal">Costo: {skill.cost} Puntos</span>
                </button>
            ))}
        </div>
    </div>
);

const CraftingPanel = ({ hero, onUpgradeItem }) => {
    const getUpgradeCost = (item) => {
        if (!item) return null;
        const level = item.upgradeLevel || 0;
        return {
            gold: 100 * (level + 1),
            scrap: 5 * (level + 1),
            essence: item.rarity === 'common' ? 0 : 1 * (level + 1),
        };
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg h-full">
            <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Forja</h2>
            <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Materiales</h3>
                <div className="flex justify-around bg-gray-700 p-2 rounded-lg">
                    <p>{MATERIALS.scrap.icon} {MATERIALS.scrap.name}: {hero.materials.scrap}</p>
                    <p>{MATERIALS.essence.icon} {MATERIALS.essence.name}: {hero.materials.essence}</p>
                </div>
            </div>
            <div className="space-y-4">
                {Object.entries(hero.equipment).map(([slot, item]) => {
                    if (!item) return <div key={slot} className="bg-gray-700 p-4 rounded-lg text-center text-gray-400">Espacio de {slot} vacío</div>;
                    
                    const cost = getUpgradeCost(item);
                    const canAfford = hero.gold >= cost.gold && hero.materials.scrap >= cost.scrap && hero.materials.essence >= cost.essence;

                    return (
                        <div key={slot} className="bg-gray-700 p-4 rounded-lg">
                            <p className="font-bold">{item.icon} {item.name} +{item.upgradeLevel}</p>
                            <button 
                                onClick={() => onUpgradeItem(slot)}
                                disabled={!canAfford}
                                className="w-full mt-2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded transition duration-300 disabled:bg-gray-500"
                            >
                                Mejorar
                            </button>
                            <p className="text-xs text-center mt-1">
                                Costo: {cost.gold} Oro, {cost.scrap} {MATERIALS.scrap.icon}, {cost.essence} {MATERIALS.essence.icon}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const PetPanel = ({ pets, gold, onActivate, onLevelUp }) => {
    const getLevelUpCost = (petId) => 100 * Math.pow(pets.levels[petId] || 1, 2);

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Compañeros</h2>
            <div className="space-y-4">
                {pets.owned.map(petId => {
                    const pet = PETS[petId];
                    const level = pets.levels[petId];
                    const isActive = pets.activePetId === petId;
                    const cost = getLevelUpCost(petId);
                    const canAfford = gold >= cost;

                    return (
                        <div key={petId} className={`p-3 rounded-lg ${isActive ? 'bg-yellow-900/50 border border-yellow-500' : 'bg-gray-700'}`}>
                            <p className="text-lg font-bold">{pet.icon} {pet.name} (Nvl. {level})</p>
                            <p className="text-sm">{pet.description}</p>
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => onActivate(petId)} disabled={isActive} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm disabled:bg-gray-500">
                                    {isActive ? 'Activo' : 'Activar'}
                                </button>
                                <button onClick={() => onLevelUp(petId)} disabled={!isActive || !canAfford} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded text-sm disabled:bg-gray-500">
                                    Subir Nivel ({cost} Oro)
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const SettingsPanel = ({ settings, onToggleMusic, onToggleSfx }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Sonido</h2>
        <div className="space-y-4">
            <button onClick={onToggleMusic} className={`w-full font-bold py-2 px-4 rounded ${settings.musicOn ? 'bg-green-600' : 'bg-red-600'}`}>
                Música: {settings.musicOn ? 'ON' : 'OFF'}
            </button>
            <button onClick={onToggleSfx} className={`w-full font-bold py-2 px-4 rounded ${settings.sfxOn ? 'bg-green-600' : 'bg-red-600'}`}>
                Efectos: {settings.sfxOn ? 'ON' : 'OFF'}
            </button>
        </div>
    </div>
);


const OfflineGainsModal = ({ gains, onClose }) => {
    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h}h ${m}m ${s}s`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-sm w-full text-center">
                <h2 className="text-2xl font-bold mb-4 text-yellow-400">¡Bienvenido de vuelta!</h2>
                <p className="mb-2">Mientras estabas fuera ({formatTime(gains.time)}), tu héroe ha conseguido:</p>
                <p className="text-xl font-semibold text-yellow-300">{gains.gold} Oro</p>
                <p className="text-xl font-semibold text-blue-400">{gains.xp} XP</p>
                {gains.levels > 0 && <p className="text-lg mt-2 text-green-400">¡Y subió {gains.levels} nivel(es)!</p>}
                <button onClick={onClose} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg">
                    Recoger
                </button>
            </div>
        </div>
    );
};

const DailyRewardModal = ({ reward, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-sm w-full text-center">
            <h2 className="text-2xl font-bold mb-4 text-yellow-400">🎁 ¡Recompensa Diaria! 🎁</h2>
            <p className="mb-4">¡Aquí tienes tu recompensa por volver hoy!</p>
            <div className="space-y-2 text-lg">
                <p><span className="text-yellow-300">{reward.gold} Oro</span></p>
                <p><span className="text-cyan-400">{reward.scrap} {MATERIALS.scrap.icon}</span></p>
                <p><span className="text-purple-400">{reward.essence} {MATERIALS.essence.icon}</span></p>
            </div>
            <button onClick={onClose} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg">
                ¡Reclamar!
            </button>
        </div>
    </div>
);


const FloatingText = ({ text, x, y, color, id }) => {
    const style = {
        left: `${x}px`,
        top: `${y}px`,
        color: color,
    };
    return (
        <div style={style} className="floating-text absolute font-bold text-xl pointer-events-none animate-floatUp">
            {text}
        </div>
    );
};

// --- HOOKS PERSONALIZADOS ---

const useAudioManager = (settings) => {
    const audioManager = useRef(null);

    useEffect(() => {
        if (typeof window.Tone === 'undefined') return;

        if (!audioManager.current) {
             const synths = {
                attack: new window.Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.1 } }).toDestination(),
                crit: new window.Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 } }).toDestination(),
                levelUp: new window.Tone.PolySynth(window.Tone.Synth).toDestination(),
                gold: new window.Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.05, sustain: 0, release: 0.1 } }).toDestination(),
                skill: new window.Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.1, decay: 0.3, sustain: 0.2, release: 0.3 } }).toDestination(),
                craft: new window.Tone.MetalSynth({ frequency: 100, envelope: { attack: 0.01, decay: 0.2, release: 0.1 }, harmonicity: 3.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination(),
            };

            const musicLoop = new window.Tone.Loop(time => {
                synths.attack.triggerAttackRelease("C2", "8n", time);
                synths.attack.triggerAttackRelease("G2", "8n", time + 0.5);
            }, "1n");
            
            audioManager.current = {
                synths,
                musicLoop,
                playSound: (sound) => {
                    if (!settings.sfxOn) return;
                    try {
                        switch(sound) {
                            case 'attack': synths.attack.triggerAttackRelease('C4', '8n'); break;
                            case 'crit': synths.crit.triggerAttackRelease('G4', '8n'); break;
                            case 'levelUp': synths.levelUp.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], '8n'); break;
                            case 'gold': synths.gold.triggerAttackRelease('C6', '16n'); break;
                            case 'skill': synths.skill.triggerAttackRelease('A3', '4n'); break;
                            case 'craft': synths.craft.triggerAttackRelease("C3", "8n", "+0.05"); break;
                            default: break;
                        }
                    } catch (e) { console.error("Error playing sound:", e); }
                },
            };
        }

        if (settings.musicOn) {
            window.Tone.Transport.start();
            audioManager.current.musicLoop.start(0);
        } else {
            audioManager.current.musicLoop.stop(0);
        }
    }, [settings.musicOn, settings.sfxOn]);

    return audioManager.current;
};

const useGameLogic = (audioManager) => {
    const [gameState, setGameState] = useState(initialGameState);
    const [offlineGains, setOfflineGains] = useState(null);
    const [dailyReward, setDailyReward] = useState(null);

    const totalStats = useMemo(() => {
        const prestigeDamageBonus = 1 + (gameState.prestigeUpgrades.damageBonus.level * gameState.prestigeUpgrades.damageBonus.increase);
        const passiveDamageBonus = 1 + (gameState.passiveSkills.increasedDamage.level * gameState.passiveSkills.increasedDamage.increase);
        const passiveHealthBonus = 1 + (gameState.passiveSkills.increasedHealth.level * gameState.passiveSkills.increasedHealth.increase);
        
        let petDamageBonus = 1;
        let petCritBonus = 0;
        const activePet = PETS[gameState.pets.activePetId];
        if (activePet) {
            const petLevel = gameState.pets.levels[activePet.id] || 0;
            if (activePet.bonusStat === 'damage') {
                petDamageBonus = 1 + (petLevel * activePet.bonusPerLevel);
            }
            if (activePet.bonusStat === 'critChance') {
                petCritBonus = petLevel * activePet.bonusPerLevel;
            }
        }

        const stats = {
            damage: gameState.hero.damage * prestigeDamageBonus * passiveDamageBonus * petDamageBonus,
            maxHp: gameState.hero.maxHp * passiveHealthBonus,
            critChance: gameState.hero.critChance + petCritBonus,
        };

        for (const slot in gameState.hero.equipment) {
            const item = gameState.hero.equipment[slot];
            if (item) {
                stats[item.stat] += item.value;
            }
        }
        return stats;
    }, [gameState.hero, gameState.prestigeUpgrades, gameState.passiveSkills, gameState.pets]);

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now() + Math.random();
        setGameState(prev => ({
            ...prev,
            toasts: [...prev.toasts, { id, message, type }],
        }));
    }, []);

    const dismissToast = useCallback((id) => {
        setGameState(prev => ({
            ...prev,
            toasts: prev.toasts.filter(t => t.id !== id),
        }));
    }, []);

    const addLogMessage = useCallback((text, color) => {
        setGameState(prev => ({
            ...prev,
            combatLog: [...prev.combatLog.slice(-10), { text, color }],
        }));
    }, []);

    const createFloatingText = useCallback((text, color, customYOffset = 0) => {
        const container = document.getElementById('monster-art-container');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 50;
        const y = rect.top + rect.height / 2 + (Math.random() - 0.5) * 30 + customYOffset;
        const id = Date.now() + Math.random();

        setGameState(prev => ({
            ...prev,
            floatingTexts: [...prev.floatingTexts, { id, text, x, y, color }],
        }));

        setTimeout(() => {
            setGameState(prev => ({
                ...prev,
                floatingTexts: prev.floatingTexts.filter(ft => ft.id !== id),
            }));
        }, 1000);
    }, []);

    const generateLoot = useCallback((stage, isBoss = false) => {
        const dropChance = isBoss ? 0.8 : 0.2;
        if (Math.random() > dropChance) return null;

        const rarityRoll = Math.random();
        let rarity;
        if (isBoss) {
            if (rarityRoll < 0.2) rarity = 'epic';
            else if (rarityRoll < 0.6) rarity = 'rare';
            else rarity = 'common';
        } else {
            if (rarityRoll < 0.05) rarity = 'epic';
            else if (rarityRoll < 0.25) rarity = 'rare';
            else rarity = 'common';
        }

        const itemTypes = Object.keys(ITEM_TEMPLATES);
        const itemTypeKey = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        const template = ITEM_TEMPLATES[itemTypeKey];
        const value = template.baseValue * ITEM_RARITIES[rarity].multiplier * (1 + (stage - 1) * 0.1);

        return {
            id: Date.now() + Math.random(),
            name: `${template.name} ${ITEM_RARITIES[rarity].name}`,
            icon: template.icon,
            type: itemTypeKey,
            stat: template.stat,
            value: value,
            rarity: rarity,
            upgradeLevel: 0,
        };
    }, []);

    const spawnBoss = useCallback(() => {
        setGameState(prev => {
            const stageMultiplier = 1 + (prev.stage - 1) * 0.2;
            const bossNames = ["Rey Goblin", "Señor Esqueleto", "Limo Primordial", "Líder de la Manada", "Madre Araña"];
            const boss = {
                name: `${bossNames[Math.floor(Math.random() * bossNames.length)]} (JEFE)`,
                maxHp: Math.round(50 * stageMultiplier * 10),
                hp: Math.round(50 * stageMultiplier * 10),
                goldReward: Math.round(5 * stageMultiplier * 15),
                xpReward: Math.round(10 * stageMultiplier * 15),
                art: prev.bossArt[Math.floor(Math.random() * prev.bossArt.length)],
                abilities: ['heal', 'dodge', 'poison'], // Los jefes tienen todas las habilidades
                usedHeal: false,
            };
            addLogMessage(`¡Un JEFE ha aparecido: ${boss.name}!`, 'text-yellow-400 font-bold');
            addToast(`¡Un JEFE ha aparecido!`, 'warning');
            return { ...prev, monster: boss, isBossFight: true, bossTimer: 30 };
        });
    }, [addLogMessage, addToast]);

    const spawnNewMonster = useCallback(() => {
        setGameState(prev => {
            const stageMultiplier = 1 + (prev.stage - 1) * 0.2;
            const monsterNames = ["Goblin", "Esqueleto", "Limo", "Lobo", "Araña Gigante", "Golem", "Dragón Joven"];
            
            // Asignar habilidades aleatorias a monstruos normales
            const abilities = [];
            if (Math.random() < 0.2) abilities.push('heal');
            if (Math.random() < 0.1) abilities.push('dodge');
            if (Math.random() < 0.15) abilities.push('poison');

            const newMonster = {
                ...prev.monster,
                name: `${monsterNames[Math.floor(Math.random() * monsterNames.length)]} (Etapa ${prev.stage})`,
                maxHp: Math.round(50 * stageMultiplier * (1 + Math.random() * 0.2)),
                hp: Math.round(50 * stageMultiplier * (1 + Math.random() * 0.2)),
                goldReward: Math.round(5 * stageMultiplier),
                xpReward: Math.round(10 * stageMultiplier),
                art: prev.monsterArt[Math.floor(Math.random() * prev.monsterArt.length)],
                abilities: abilities,
                usedHeal: false,
            };
            addLogMessage(`Un ${newMonster.name} salvaje apareció!`, 'text-gray-400');
            return { ...prev, monster: newMonster, isBossFight: false };
        });
    }, [addLogMessage]);

    const heroAttack = useCallback(() => {
        setGameState(prev => {
            if (prev.monster.hp <= 0) return prev;

            let damageDealt = totalStats.damage;
            let isCrit = Math.random() < totalStats.critChance;
            
            // Habilidad de esquivar del monstruo
            let modifiedState = { ...prev };
            if (prev.monster.abilities.includes('dodge')) {
                const result = MONSTER_ABILITIES.dodge.effect(prev.monster, prev.hero, prev, addLogMessage, createFloatingText, damageDealt);
                damageDealt = result.damageDealt;
            }

            if (damageDealt > 0) {
                if (prev.effects.powerfulStrikeActive) {
                    damageDealt *= 3;
                    addLogMessage(`¡GOLPE PODEROSO! Héroe ataca por ${damageDealt.toFixed(0)} de daño.`, 'text-orange-500 font-bold');
                    createFloatingText(damageDealt.toFixed(0), 'orange');
                    audioManager?.playSound('crit');
                } else if (isCrit) {
                    damageDealt = Math.round(damageDealt * prev.hero.critMultiplier);
                    addLogMessage(`¡GOLPE CRÍTICO! Héroe ataca por ${damageDealt} de daño.`, 'text-yellow-400');
                    createFloatingText(damageDealt, 'yellow');
                    audioManager?.playSound('crit');
                } else {
                    addLogMessage(`Héroe ataca por ${damageDealt.toFixed(0)} de daño.`, 'text-green-400');
                    createFloatingText(damageDealt.toFixed(0), 'white');
                    audioManager?.playSound('attack');
                }
            }
            
            const newStateWithAnimation = { ...modifiedState, monsterAnimation: 'shake' };
            setTimeout(() => setGameState(p => ({ ...p, monsterAnimation: '' })), 200);

            const newMonsterHp = prev.monster.hp - damageDealt;
            let newState = { 
                ...newStateWithAnimation, 
                monster: { ...prev.monster, hp: newMonsterHp },
                effects: { ...prev.effects, powerfulStrikeActive: false }
            };

            // Habilidad de curación del monstruo
            if (newState.monster.abilities.includes('heal')) {
                const result = MONSTER_ABILITIES.heal.effect(newState.monster, newState.hero, newState, addLogMessage, createFloatingText);
                newState.monster = result.monster;
            }

            if (newMonsterHp <= 0) {
                newState.monsterAnimation = 'fadeOut';

                if (prev.isBossFight) {
                    addLogMessage(`¡JEFE DERROTADO!`, 'text-yellow-400 font-bold text-lg');
                    newState.stage++;
                    newState.monstersKilledInStage = 0;
                    addLogMessage(`¡Has avanzado a la etapa ${newState.stage}!`, 'text-purple-400 font-bold');
                } else {
                    newState.monstersKilledInStage++;
                }

                addLogMessage(`${prev.monster.name} ha sido derrotado!`, 'text-red-500');
                
                let goldBonus = 1 + (prev.prestigeUpgrades.goldBonus.level * prev.prestigeUpgrades.goldBonus.increase);
                const activePet = PETS[prev.pets.activePetId];
                if (activePet && activePet.bonusStat === 'gold') {
                    goldBonus += (prev.pets.levels[activePet.id] || 0) * activePet.bonusPerLevel;
                }

                let goldGained = Math.round(prev.monster.goldReward * goldBonus);

                if (prev.effects.goldRushActive) {
                    goldGained *= 2;
                    addLogMessage(`¡Lluvia de Oro! Recompensa duplicada.`, 'text-yellow-400 font-bold');
                    newState.effects.goldRushActive = false;
                }

                addLogMessage(`+${goldGained} Oro, +${prev.monster.xpReward} XP`, 'text-yellow-300');
                
                const loot = generateLoot(newState.stage, prev.isBossFight);
                if (loot) {
                    newState.inventory = [...newState.inventory, loot];
                    const rarityInfo = ITEM_RARITIES[loot.rarity];
                    addLogMessage(`¡Has encontrado ${loot.name}!`, rarityInfo.color);
                    if (loot.rarity === 'rare' || loot.rarity === 'epic') {
                        addToast(`¡Botín ${rarityInfo.name}! ${loot.icon} ${loot.name}`, `loot-${loot.rarity}`);
                    }
                    audioManager?.playSound('gold');
                }

                newState.hero.gold += goldGained;
                let newXp = newState.hero.xp + prev.monster.xpReward;
                let newLevel = newState.hero.level;
                let newXpNeeded = newState.hero.xpNeeded;
                let newMaxHp = newState.hero.maxHp;
                let newDamage = newState.hero.damage;
                let newSkillPoints = newState.hero.skillPoints;

                while (newXp >= newXpNeeded) {
                    newLevel++;
                    newXp -= newXpNeeded;
                    newXpNeeded = Math.round(newXpNeeded * 1.5);
                    newMaxHp += 20;
                    newDamage += 5;
                    newSkillPoints++;
                    addLogMessage(`¡SUBISTE DE NIVEL! Ahora eres nivel ${newLevel}.`, 'text-blue-400 font-bold');
                    addToast(`¡Nivel ${newLevel} alcanzado!`, 'success');
                    audioManager?.playSound('levelUp');
                }
                
                newState.hero = {
                    ...newState.hero,
                    xp: newXp,
                    level: newLevel,
                    xpNeeded: newXpNeeded,
                    maxHp: newMaxHp,
                    damage: newDamage,
                    hp: totalStats.maxHp, 
                    skillPoints: newSkillPoints,
                };
            }
            return newState;
        });
    }, [addLogMessage, createFloatingText, generateLoot, totalStats, audioManager, addToast]);
    
    // NUEVO: Lógica de ataque del monstruo y efectos de estado
    const monsterAttack = useCallback(() => {
        setGameState(prev => {
            let newHero = { ...prev.hero };
            let newMonster = { ...prev.monster };

            // Habilidad de veneno del monstruo
            if (newMonster.abilities.includes('poison')) {
                const result = MONSTER_ABILITIES.poison.effect(newMonster, newHero, prev, addLogMessage, createFloatingText);
                newHero = result.hero;
            }

            // Aplicar daño de veneno si el héroe está envenenado
            if (newHero.effects.poisoned) {
                newHero.hp -= newHero.effects.poisoned.damage;
                addLogMessage(`Sufres ${newHero.effects.poisoned.damage.toFixed(0)} de daño por veneno.`, 'text-purple-400');
                createFloatingText(`-${newHero.effects.poisoned.damage.toFixed(0)}`, 'purple');
                newHero.effects.poisoned.duration -= 1;
                if (newHero.effects.poisoned.duration <= 0) {
                    newHero.effects.poisoned = null;
                    addLogMessage('El veneno ha desaparecido.', 'text-gray-400');
                }
            }

            if (newHero.hp <= 0) {
                addLogMessage('¡Has sido derrotado! Te recuperas...', 'text-red-600 font-bold');
                newHero.hp = totalStats.maxHp;
            }

            return { ...prev, hero: newHero };
        });
    }, [addLogMessage, createFloatingText, totalStats]);


    const useSkill = useCallback((skillId) => {
        setGameState(prev => {
            const skill = prev.skills[skillId];
            if (skill.remaining > 0) return prev;

            let newState = { ...prev };
            
            switch (skillId) {
                case 'powerfulStrike':
                    newState.effects.powerfulStrikeActive = true;
                    addLogMessage('¡Preparando un Golpe Poderoso!', 'text-orange-400');
                    break;
                case 'quickHeal':
                    const healAmount = Math.round(totalStats.maxHp * 0.25);
                    newState.hero.hp = Math.min(totalStats.maxHp, prev.hero.hp + healAmount);
                    addLogMessage(`¡Te curas por ${healAmount} HP!`, 'text-teal-400');
                    createFloatingText(`+${healAmount} HP`, 'lightgreen', -30);
                    break;
                case 'goldRush':
                    newState.effects.goldRushActive = true;
                    addLogMessage('¡El próximo monstruo soltará el doble de oro!', 'text-yellow-400');
                    break;
                default:
                    return prev;
            }
            
            audioManager?.playSound('skill');
            const cooldownReduction = 1 - (prev.passiveSkills.fasterCooldowns.level * prev.passiveSkills.fasterCooldowns.increase);
            const finalCooldown = Math.max(1, skill.cooldown * cooldownReduction);

            newState.skills[skillId].remaining = finalCooldown;
            return newState;
        });
    }, [addLogMessage, createFloatingText, totalStats, audioManager]);

    const equipItem = useCallback((itemId) => {
        setGameState(prev => {
            const itemToEquip = prev.inventory.find(item => item.id === itemId);
            if (!itemToEquip) return prev;

            const newInventory = prev.inventory.filter(item => item.id !== itemId);
            const currentItem = prev.hero.equipment[itemToEquip.type];
            if (currentItem) {
                newInventory.push(currentItem);
            }

            const newEquipment = { ...prev.hero.equipment, [itemToEquip.type]: itemToEquip };
            return { ...prev, inventory: newInventory, hero: { ...prev.hero, equipment: newEquipment } };
        });
    }, []);

    const unequipItem = useCallback((slot) => {
        setGameState(prev => {
            const itemToUnequip = prev.hero.equipment[slot];
            if (!itemToUnequip) return prev;

            const newInventory = [...prev.inventory, itemToUnequip];
            const newEquipment = { ...prev.hero.equipment, [slot]: null };
            return { ...prev, inventory: newInventory, hero: { ...prev.hero, equipment: newEquipment } };
        });
    }, []);

    const dismantleItem = useCallback((itemId) => {
        setGameState(prev => {
            const itemToDismantle = prev.inventory.find(item => item.id === itemId);
            if (!itemToDismantle) return prev;
            
            const newInventory = prev.inventory.filter(item => item.id !== itemId);
            const materialsGained = ITEM_RARITIES[itemToDismantle.rarity].dismantle;
            const newMaterials = { ...prev.hero.materials };

            let logMsg = "Desmantelado: ";
            let first = true;
            for (const mat in materialsGained) {
                if(!first) logMsg += ", ";
                newMaterials[mat] += materialsGained[mat];
                logMsg += `+${materialsGained[mat]} ${MATERIALS[mat].icon}`;
                first = false;
            }
            addLogMessage(logMsg, 'text-gray-400');
            audioManager?.playSound('craft');

            return { ...prev, inventory: newInventory, hero: { ...prev.hero, materials: newMaterials }};
        });
    }, [addLogMessage, audioManager]);

    const sellItem = useCallback((itemId) => {
        setGameState(prev => {
            const itemToSell = prev.inventory.find(item => item.id === itemId);
            if (!itemToSell) return prev;

            const newInventory = prev.inventory.filter(item => item.id !== itemId);
            
            const baseValue = ITEM_RARITIES[itemToSell.rarity].sellValue;
            const finalValue = Math.round(baseValue * (1 + (itemToSell.upgradeLevel || 0) * 0.5));

            const newHero = { ...prev.hero, gold: prev.hero.gold + finalValue };
            
            addLogMessage(`Vendido ${itemToSell.name} por ${finalValue} oro.`, 'text-yellow-300');
            audioManager?.playSound('gold');

            return { ...prev, inventory: newInventory, hero: newHero };
        });
    }, [addLogMessage, audioManager]);


    const upgradeItem = useCallback((slot) => {
        setGameState(prev => {
            const item = prev.hero.equipment[slot];
            if (!item) return prev;

            const level = item.upgradeLevel || 0;
            const cost = {
                gold: 100 * (level + 1),
                scrap: 5 * (level + 1),
                essence: item.rarity === 'common' ? 0 : 1 * (level + 1),
            };
            
            if (prev.hero.gold < cost.gold || prev.hero.materials.scrap < cost.scrap || prev.hero.materials.essence < cost.essence) {
                return prev;
            }

            const newHero = {
                ...prev.hero,
                gold: prev.hero.gold - cost.gold,
                materials: {
                    scrap: prev.hero.materials.scrap - cost.scrap,
                    essence: prev.hero.materials.essence - cost.essence,
                }
            };

            const template = ITEM_TEMPLATES[item.type];
            const statIncrease = template.baseValue * ITEM_RARITIES[item.rarity].multiplier * 0.1;

            const upgradedItem = {
                ...item,
                upgradeLevel: level + 1,
                value: item.value + statIncrease,
            };

            const newEquipment = { ...prev.hero.equipment, [slot]: upgradedItem };

            addLogMessage(`¡${item.name} mejorado a +${upgradedItem.upgradeLevel}!`, 'text-orange-400');
            audioManager?.playSound('craft');

            return { ...prev, hero: { ...newHero, equipment: newEquipment }};
        });
    }, [addLogMessage, audioManager]);

    const handlePrestige = useCallback(() => {
        setGameState(prev => {
            if (prev.hero.level < prev.prestige.nextLevelReq) return prev;

            const relicsGained = Math.floor(prev.stage / 5) + prev.hero.level;
            addLogMessage(`¡RENACIMIENTO! Has ganado ${relicsGained} reliquias.`, 'text-yellow-200 font-bold text-lg');
            addToast(`¡Renacimiento! +${relicsGained} Reliquias`, 'prestige');

            return {
                ...prev,
                hero: { ...initialHeroState, skillPoints: prev.hero.skillPoints, materials: prev.hero.materials },
                inventory: [],
                upgrades: initialGameState.upgrades,
                stage: 1,
                monstersKilledInStage: 0,
                isBossFight: false,
                bossTimer: 30,
                prestige: {
                    level: prev.prestige.level + 1,
                    relics: prev.prestige.relics + relicsGained,
                    nextLevelReq: prev.prestige.nextLevelReq + 10,
                }
            };
        });
    }, [addLogMessage, addToast]);

    const handlePrestigeUpgrade = useCallback((upgradeId) => {
        setGameState(prev => {
            const upgrade = prev.prestigeUpgrades[upgradeId];
            if (prev.prestige.relics < upgrade.cost) return prev;

            const newPrestige = { ...prev.prestige, relics: prev.prestige.relics - upgrade.cost };
            const newPrestigeUpgrades = {
                ...prev.prestigeUpgrades,
                [upgradeId]: {
                    ...upgrade,
                    level: upgrade.level + 1,
                    cost: upgrade.cost + (upgrade.level + 1),
                }
            };
            
            return { ...prev, prestige: newPrestige, prestigeUpgrades: newPrestigeUpgrades };
        });
    }, []);

    const handlePassiveSkillUpgrade = useCallback((skillId) => {
        setGameState(prev => {
            const skill = prev.passiveSkills[skillId];
            if (prev.hero.skillPoints < skill.cost) return prev;

            const newHero = { ...prev.hero, skillPoints: prev.hero.skillPoints - skill.cost };
            const newPassiveSkills = {
                ...prev.passiveSkills,
                [skillId]: {
                    ...skill,
                    level: skill.level + 1,
                    cost: skill.cost + (skill.level < 5 ? 1 : 2),
                }
            };
            
            return { ...prev, hero: newHero, passiveSkills: newPassiveSkills };
        });
    }, []);

    const handleActivatePet = useCallback((petId) => {
        setGameState(prev => ({ ...prev, pets: { ...prev.pets, activePetId: petId } }));
    }, []);

    const handleLevelUpPet = useCallback((petId) => {
        setGameState(prev => {
            const level = prev.pets.levels[petId] || 0;
            const cost = 100 * Math.pow(level + 1, 2);
            if (prev.hero.gold < cost) return prev;

            const newLevels = { ...prev.pets.levels, [petId]: level + 1 };
            const newHero = { ...prev.hero, gold: prev.hero.gold - cost };
            return { ...prev, hero: newHero, pets: { ...prev.pets, levels: newLevels } };
        });
    }, []);

    const handleClaimDailyReward = useCallback(() => {
        if (!dailyReward) return;
        setGameState(prev => {
            const newHero = {
                ...prev.hero,
                gold: prev.hero.gold + dailyReward.gold,
                materials: {
                    scrap: prev.hero.materials.scrap + dailyReward.scrap,
                    essence: prev.hero.materials.essence + dailyReward.essence,
                }
            };
            addLogMessage(`¡Recompensa diaria reclamada!`, 'text-green-400');
            return {
                ...prev,
                hero: newHero,
                lastDailyReward: new Date().toISOString().split('T')[0],
            }
        });
        setDailyReward(null);
    }, [dailyReward, addLogMessage]);

    const handleToggleMusic = () => {
        setGameState(prev => ({ ...prev, settings: { ...prev.settings, musicOn: !prev.settings.musicOn } }));
    };

    const handleToggleSfx = () => {
        setGameState(prev => ({ ...prev, settings: { ...prev.settings, sfxOn: !prev.settings.sfxOn } }));
    };

    const handleUpgrade = (upgradeType) => {
        setGameState(prev => {
            const upgrade = prev.upgrades[upgradeType];
            if (prev.hero.gold < upgrade.cost) return prev;

            const newHero = { ...prev.hero, gold: prev.hero.gold - upgrade.cost };
            const newUpgrades = { ...prev.upgrades };

            if (upgradeType === 'damage') {
                newHero.damage += upgrade.increase;
                newUpgrades.damage.cost = Math.round(upgrade.cost * 1.15);
            } else if (upgradeType === 'health') {
                newHero.maxHp += upgrade.increase;
                newHero.hp += upgrade.increase;
                newUpgrades.health.cost = Math.round(upgrade.cost * 1.2);
            } else if (upgradeType === 'critChance') {
                newHero.critChance += upgrade.increase;
                newUpgrades.critChance.cost = Math.round(upgrade.cost * 1.5);
            }

            return { ...prev, hero: newHero, upgrades: newUpgrades };
        });
    };
    
    const clearOfflineGains = useCallback(() => {
        setOfflineGains(null);
    }, []);

    useEffect(() => {
        const gameInterval = setInterval(() => {
            if (!gameState.isBossFight || gameState.bossTimer > 0) {
                heroAttack();
            }
            monsterAttack(); // El monstruo ataca/usa efectos cada segundo
        }, 1000);
        return () => clearInterval(gameInterval);
    }, [heroAttack, monsterAttack, gameState.isBossFight, gameState.bossTimer]);
    
    useEffect(() => {
        const cooldownInterval = setInterval(() => {
            setGameState(prev => {
                const newSkills = { ...prev.skills };
                let changed = false;
                for (const skillId in newSkills) {
                    if (newSkills[skillId].remaining > 0) {
                        newSkills[skillId].remaining = Math.max(0, newSkills[skillId].remaining - 1);
                        changed = true;
                    }
                }
                return changed ? { ...prev, skills: newSkills } : prev;
            });
        }, 1000);
        return () => clearInterval(cooldownInterval);
    }, []);

    useEffect(() => {
        if (gameState.monster.hp <= 0) {
            const timeout = setTimeout(() => {
                if (gameState.isBossFight) {
                    spawnNewMonster();
                } else if (gameState.monstersKilledInStage >= gameState.monstersPerStage) {
                    spawnBoss();
                } else {
                    spawnNewMonster();
                }
            }, 1000);
            return () => clearTimeout(timeout);
        }
    }, [gameState.monster.hp, gameState.monstersKilledInStage, gameState.monstersPerStage, gameState.isBossFight, spawnNewMonster, spawnBoss]);
    
    useEffect(() => {
        if (!gameState.isBossFight) return;

        const timerInterval = setInterval(() => {
            setGameState(prev => {
                if (prev.bossTimer > 0) {
                    return { ...prev, bossTimer: prev.bossTimer - 1 };
                } else {
                    addLogMessage('¡Tiempo agotado! El jefe se ha recuperado.', 'text-red-500 font-bold');
                    const newMonster = { ...prev.monster, hp: prev.monster.maxHp };
                    return { ...prev, monster: newMonster, bossTimer: 30 };
                }
            });
        }, 1000);

        return () => clearInterval(timerInterval);
    }, [gameState.isBossFight, addLogMessage]);

    useEffect(() => {
        const savedStateJSON = localStorage.getItem('idleRpgGameState');
        const lastSaveTime = localStorage.getItem('idleRpgLastSave');

        if (savedStateJSON) {
            let loadedState = JSON.parse(savedStateJSON);
            
            loadedState = {
                ...initialGameState,
                ...loadedState,
                hero: { ...initialGameState.hero, ...loadedState.hero },
                monster: { ...initialGameState.monster, ...loadedState.monster }, // CORRECCIÓN
                prestige: { ...initialGameState.prestige, ...loadedState.prestige },
                prestigeUpgrades: { ...initialGameState.prestigeUpgrades, ...loadedState.prestigeUpgrades },
                passiveSkills: { ...initialGameState.passiveSkills, ...loadedState.passiveSkills },
                pets: { ...initialGameState.pets, ...loadedState.pets },
                settings: { ...initialGameState.settings, ...loadedState.settings },
                toasts: [],
            };

            const today = new Date().toISOString().split('T')[0];
            if (loadedState.lastDailyReward !== today) {
                setDailyReward({ gold: 500, scrap: 10, essence: 2 });
            }

            if (lastSaveTime) {
                const currentTime = Date.now();
                const offlineSeconds = Math.floor((currentTime - parseInt(lastSaveTime, 10)) / 1000);

                if (offlineSeconds > 10) { 
                    const goldBonus = 1 + (loadedState.prestigeUpgrades.goldBonus.level * loadedState.prestigeUpgrades.goldBonus.increase);
                    const avgGoldPerKill = Math.round(5 * (1 + (loadedState.stage - 1) * 0.2) * goldBonus);
                    const avgXpPerKill = Math.round(10 * (1 + (loadedState.stage - 1) * 0.2));
                    const killsPerSecond = 1 / 4; 
                    const offlineRate = 0.25; 

                    const goldGained = Math.floor(offlineSeconds * killsPerSecond * avgGoldPerKill * offlineRate);
                    let xpGained = Math.floor(offlineSeconds * killsPerSecond * avgXpPerKill * offlineRate);
                    
                    loadedState.hero.gold += goldGained;
                    let currentXp = loadedState.hero.xp + xpGained;
                    let levelsGained = 0;

                    while (currentXp >= loadedState.hero.xpNeeded) {
                        currentXp -= loadedState.hero.xpNeeded;
                        loadedState.hero.level++;
                        levelsGained++;
                        loadedState.hero.xpNeeded = Math.round(loadedState.hero.xpNeeded * 1.5);
                        loadedState.hero.maxHp += 20;
                        loadedState.hero.damage += 5;
                        loadedState.hero.skillPoints++;
                    }
                    loadedState.hero.xp = currentXp;
                    loadedState.hero.hp = loadedState.hero.maxHp;

                    setOfflineGains({ gold: goldGained, xp: xpGained, time: offlineSeconds, levels: levelsGained });
                }
            }
            setGameState(loadedState);
        }
    }, []);

    useEffect(() => {
        const saveInterval = setInterval(() => {
            localStorage.setItem('idleRpgGameState', JSON.stringify(gameState));
            localStorage.setItem('idleRpgLastSave', Date.now().toString());
        }, 5000);

        return () => clearInterval(saveInterval);
    }, [gameState]);

    return {
        gameState,
        offlineGains,
        dailyReward,
        totalStats,
        handlers: {
            handleUpgrade,
            useSkill,
            equipItem,
            unequipItem,
            dismantleItem,
            sellItem,
            upgradeItem,
            handlePrestige,
            handlePrestigeUpgrade,
            handlePassiveSkillUpgrade,
            handleActivatePet,
            handleLevelUpPet,
            handleClaimDailyReward,
            handleToggleMusic,
            handleToggleSfx,
            clearOfflineGains,
            dismissToast,
        }
    };
};


// --- Componente Principal de la App ---
export default function App() {
    const [isAudioReady, setIsAudioReady] = useState(false);
    const [activeTab, setActiveTab] = useState('upgrades');

    const audioManager = useAudioManager(initialGameState.settings); 

    const {
        gameState,
        offlineGains,
        dailyReward,
        totalStats,
        handlers
    } = useGameLogic(audioManager);

    const handleStartGame = async () => {
        if (typeof window.Tone !== 'undefined') {
            await window.Tone.start();
            setIsAudioReady(true);
        } else {
            alert("La librería de audio no pudo cargar. El juego funcionará sin sonido.");
            setIsAudioReady(true);
        }
    };

    const animations = `
        @keyframes floatUp { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-50px); } }
        .floating-text { animation: floatUp 1s ease-out forwards; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px) rotate(-2deg); } 75% { transform: translateX(5px) rotate(2deg); } }
        .shake { animation: shake 0.2s ease-in-out; }
        @keyframes fadeOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.5); } }
        .fadeOut { animation: fadeOut 0.5s ease-out forwards; }
        
        @keyframes toast-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-toast-in { animation: toast-in 0.5s ease-out forwards; }
        @keyframes toast-out { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        .animate-toast-out { animation: toast-out 0.5s ease-in forwards; }
    `;

    const TabButton = ({ tabName, children }) => (
        <button 
            onClick={() => setActiveTab(tabName)}
            className={`flex-1 py-2 px-4 rounded-t-lg font-semibold transition-colors ${activeTab === tabName ? 'bg-gray-800 text-yellow-400' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
        >
            {children}
        </button>
    );

    const activePet = PETS[gameState.pets.activePetId];
    const petLevel = gameState.pets.levels[gameState.pets.activePetId];

    if (!isAudioReady) {
        return (
            <div className="bg-gray-900 text-white flex items-center justify-center min-h-screen">
                 <script src="https://unpkg.com/tone@14.7.77/build/Tone.js"></script>
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-8">Aventura Idle con React</h1>
                    <button onClick={handleStartGame} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-2xl animate-pulse">
                        Comenzar Aventura
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 text-white flex items-center justify-center min-h-screen font-sans">
            <style>{animations}</style>

            {offlineGains && <OfflineGainsModal gains={offlineGains} onClose={handlers.clearOfflineGains} />}
            {dailyReward && <DailyRewardModal reward={dailyReward} onClose={handlers.handleClaimDailyReward} />}
            
            <ToastContainer toasts={gameState.toasts} onDismiss={handlers.dismissToast} />

            {gameState.floatingTexts.map(ft => (
                <FloatingText key={ft.id} {...ft} />
            ))}

            <div className="container mx-auto p-4 max-w-7xl w-full">
                <h1 className="text-4xl font-bold text-center mb-6 text-yellow-400">Aventura Idle con React</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Columna Izquierda */}
                    <div className="flex flex-col gap-6">
                       <HeroPanel hero={{...gameState.hero, petLevel}} stats={totalStats} prestige={gameState.prestige} activePet={activePet} />
                       <SettingsPanel settings={gameState.settings} onToggleMusic={handlers.handleToggleMusic} onToggleSfx={handlers.handleToggleSfx} />
                       <PetPanel pets={gameState.pets} gold={gameState.hero.gold} onActivate={handlers.handleActivatePet} onLevelUp={handlers.handleLevelUpPet} />
                       <SkillsPanel skills={gameState.skills} onUseSkill={handlers.useSkill} />
                    </div>
                    {/* Columna Central */}
                    <div className="flex flex-col gap-6">
                       <CombatPanel 
                           monster={gameState.monster} 
                           stage={gameState.stage} 
                           combatLog={gameState.combatLog}
                           isBossFight={gameState.isBossFight}
                           bossTimer={gameState.bossTimer}
                           monsterAnimation={gameState.monsterAnimation}
                       />
                       <InventoryPanel 
                            equipment={gameState.hero.equipment} 
                            inventory={gameState.inventory} 
                            onEquip={handlers.equipItem}
                            onUnequip={handlers.unequipItem}
                            onDismantle={handlers.dismantleItem}
                            onSell={handlers.sellItem}
                        />
                    </div>
                    {/* Columna Derecha */}
                    <div className="flex flex-col gap-6">
                        <div className="flex">
                            <TabButton tabName="upgrades">Mejoras</TabButton>
                            <TabButton tabName="prestige">Reliquias</TabButton>
                            <TabButton tabName="passives">Pasivas</TabButton>
                            <TabButton tabName="crafting">Forja</TabButton>
                        </div>

                        {activeTab === 'upgrades' && <UpgradesPanel gold={gameState.hero.gold} upgrades={gameState.upgrades} onUpgrade={handlers.handleUpgrade} />}
                        {activeTab === 'prestige' && 
                            <>
                                <PrestigePanel hero={gameState.hero} prestige={gameState.prestige} onPrestige={handlers.handlePrestige} />
                                <PrestigeUpgradesPanel 
                                    relics={gameState.prestige.relics}
                                    upgrades={gameState.prestigeUpgrades}
                                    onUpgrade={handlers.handlePrestigeUpgrade}
                                />
                            </>
                        }
                        {activeTab === 'passives' && <PassiveSkillsPanel
                            skillPoints={gameState.hero.skillPoints}
                            skills={gameState.passiveSkills}
                            onUpgrade={handlers.handlePassiveSkillUpgrade}
                        />}
                        {activeTab === 'crafting' && <CraftingPanel
                            hero={gameState.hero}
                            onUpgradeItem={handlers.upgradeItem}
                        />}
                    </div>
                </div>
            </div>
        </div>
    );
}
